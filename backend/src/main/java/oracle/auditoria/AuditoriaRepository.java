package oracle.auditoria;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import oracle.common.support.CondicionSql;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Acceso a auditoria_eventos con JdbcTemplate: insercion por lotes (append-only,
 * sin entidad JPA que pueda emitir UPDATE; reWriteBatchedInserts la convierte
 * en un unico INSERT multi-fila) y lecturas con WHERE dinamico.
 * Orden canonico: ocurrido_en DESC, id DESC (sale de idx_auditoria_ocurrido,
 * sin Sort).
 */
@Repository
class AuditoriaRepository {

    private static final String COLUMNAS = """
            e.id, e.ocurrido_en, e.actor_id, e.actor_usuario, e.accion, e.entidad, e.entidad_id,
            e.resultado::text AS resultado, host(e.ip) AS ip, e.user_agent, e.id_correlacion,
            e.detalle::text AS detalle""";

    private static final String INSERT = """
            INSERT INTO auditoria_eventos
              (ocurrido_en, actor_id, actor_usuario, accion, entidad, entidad_id, resultado,
               ip, user_agent, id_correlacion, detalle)
            VALUES (?, ?, ?, ?, ?, ?, ?::resultado_auditoria, a_inet(?), ?, ?, ?::jsonb)""";

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final RowMapper<AuditoriaEventoResponse> mapeador;

    AuditoriaRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
        this.mapeador = this::mapear;
    }

    /** Inserta un lote en una sola ida a la BD. */
    void insertar(List<EventoAuditoria> lote) {
        jdbc.batchUpdate(INSERT, lote, lote.size(), (ps, e) -> {
            ps.setObject(1, OffsetDateTime.ofInstant(e.ocurridoEn(), ZoneOffset.UTC));
            if (e.actorId() == null) {
                ps.setNull(2, Types.BIGINT);
            } else {
                ps.setLong(2, e.actorId());
            }
            ps.setString(3, e.actorUsuario());
            ps.setString(4, e.accion());
            ps.setString(5, e.entidad());
            ps.setString(6, e.entidadId());
            ps.setString(7, e.resultado());
            ps.setString(8, e.ip());
            ps.setString(9, e.userAgent());
            ps.setString(10, e.idCorrelacion());
            ps.setString(11, e.detalleJson());
        });
    }

    /** Pagina por OFFSET en el orden canonico. */
    List<AuditoriaEventoResponse> pagina(CondicionSql condicion, int offset, int limite) {
        String sql = "SELECT " + COLUMNAS + " FROM auditoria_eventos e " + condicion.where()
                + " ORDER BY e.ocurrido_en DESC, e.id DESC LIMIT ? OFFSET ?";
        List<Object> args = new ArrayList<>(condicion.args());
        args.add(limite);
        args.add(offset);
        return jdbc.query(sql, mapeador, args.toArray());
    }

    /** COUNT con tope: nunca recorre mas de {@code tope} filas del indice. */
    long contar(CondicionSql condicion, long tope) {
        String sql = "SELECT COUNT(*) FROM (SELECT 1 FROM auditoria_eventos " + condicion.where() + " LIMIT ?) t";
        List<Object> args = new ArrayList<>(condicion.args());
        args.add(tope);
        Long total = jdbc.queryForObject(sql, Long.class, args.toArray());
        return total == null ? 0 : total;
    }

    /**
     * Lote por keyset (para el CSV): filas estrictamente anteriores a (ts, id)
     * en el orden canonico. Cada lote es una consulta corta: la conexion no
     * queda ocupada mientras el cliente descarga.
     */
    List<AuditoriaEventoResponse> loteAnteriorA(CondicionSql condicion, Instant ts, Long id, int limite) {
        List<Object> args = new ArrayList<>(condicion.args());
        String where = condicion.where();
        if (ts != null) {
            // Comparacion de filas (ocurrido_en, id) < (ts, id); ocurrido_en <= ts acota el rango del indice.
            where = condicion.y("ocurrido_en <= ? AND (ocurrido_en, id) < (?, ?)");
            OffsetDateTime t = OffsetDateTime.ofInstant(ts, ZoneOffset.UTC);
            args.add(t);
            args.add(t);
            args.add(id);
        }
        args.add(limite);
        String sql = "SELECT " + COLUMNAS + " FROM auditoria_eventos e " + where
                + " ORDER BY e.ocurrido_en DESC, e.id DESC LIMIT ?";
        return jdbc.query(sql, mapeador, args.toArray());
    }

    Optional<AuditoriaEventoResponse> porId(Long id) {
        return jdbc.query("SELECT " + COLUMNAS + " FROM auditoria_eventos e WHERE e.id = ?", mapeador, id)
                .stream().findFirst();
    }

    private AuditoriaEventoResponse mapear(ResultSet rs, int fila) throws SQLException {
        long actor = rs.getLong("actor_id");
        Long actorId = rs.wasNull() ? null : actor;
        OffsetDateTime ts = rs.getObject("ocurrido_en", OffsetDateTime.class);
        return new AuditoriaEventoResponse(
                rs.getLong("id"),
                ts == null ? null : ts.toInstant(),
                actorId,
                rs.getString("actor_usuario"),
                rs.getString("accion"),
                rs.getString("entidad"),
                rs.getString("entidad_id"),
                rs.getString("resultado"),
                rs.getString("ip"),
                rs.getString("user_agent"),
                rs.getString("id_correlacion"),
                detalle(rs.getString("detalle")));
    }

    private JsonNode detalle(String valor) {
        if (valor == null) {
            return null;
        }
        try {
            return json.readTree(valor);
        } catch (JacksonException ex) {
            return json.getNodeFactory().textNode(valor);
        }
    }
}
