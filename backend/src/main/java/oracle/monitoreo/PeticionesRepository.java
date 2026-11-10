package oracle.monitoreo;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import oracle.common.support.CondicionSql;
import oracle.monitoreo.Respuestas.Conteo;
import oracle.monitoreo.Respuestas.Peticion;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * bitacora.peticiones con JdbcTemplate: INSERT por lotes (reWriteBatchedInserts
 * lo convierte en un INSERT multi-fila), lecturas con WHERE dinamico en el
 * orden canonico ocurrido_en DESC, id DESC y purga por lotes.
 */
@Repository
class PeticionesRepository {

    private static final String COLUMNAS = """
            p.id, p.ocurrido_en, p.metodo, p.ruta, p.uri, p.estado, p.duracion_ms, p.actor_id,
            p.actor_usuario, host(p.ip) AS ip, p.user_agent, p.id_correlacion""";

    private static final String INSERT = """
            INSERT INTO peticiones
              (ocurrido_en, actor_id, actor_usuario, metodo, ruta, uri, estado, duracion_ms, ip, user_agent,
               id_correlacion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, a_inet(?), ?, ?)""";

    private final JdbcTemplate jdbc;
    private final RowMapper<Peticion> mapeador = PeticionesRepository::mapear;

    PeticionesRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    void insertar(List<PeticionRegistrada> lote) {
        jdbc.batchUpdate(INSERT, lote, lote.size(), (ps, p) -> {
            ps.setObject(1, OffsetDateTime.ofInstant(p.ocurridoEn(), ZoneOffset.UTC));
            if (p.actorId() == null) {
                ps.setNull(2, Types.BIGINT);
            } else {
                ps.setLong(2, p.actorId());
            }
            ps.setString(3, p.actorUsuario());
            ps.setString(4, p.metodo());
            ps.setString(5, p.ruta());
            ps.setString(6, p.uri());
            ps.setShort(7, (short) p.estado());
            ps.setInt(8, (int) Math.min(Integer.MAX_VALUE, p.duracionMs()));
            ps.setString(9, p.ip());
            ps.setString(10, p.userAgent());
            ps.setString(11, p.idCorrelacion());
        });
    }

    List<Peticion> pagina(CondicionSql c, int offset, int limite) {
        List<Object> args = new ArrayList<>(c.args());
        args.add(limite);
        args.add(offset);
        return jdbc.query("SELECT " + COLUMNAS + " FROM peticiones p " + c.where()
                + " ORDER BY p.ocurrido_en DESC, p.id DESC LIMIT ? OFFSET ?", mapeador, args.toArray());
    }

    long contar(CondicionSql c, long tope) {
        List<Object> args = new ArrayList<>(c.args());
        args.add(tope);
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM (SELECT 1 FROM peticiones p " + c.where()
                + " LIMIT ?) t", Long.class, args.toArray());
        return total == null ? 0 : total;
    }

    /** Borra hasta {@code lote} filas anteriores a {@code limite}; devuelve cuantas borro. */
    int purgar(Instant limite, int lote) {
        return jdbc.update("""
                DELETE FROM peticiones WHERE id IN (
                  SELECT id FROM peticiones WHERE ocurrido_en < ? ORDER BY ocurrido_en LIMIT ?)""",
                OffsetDateTime.ofInstant(limite, ZoneOffset.UTC), lote);
    }

    // --------------------------------------------------------- actividad de un usuario

    record Totales(long peticiones, long errores, Instant primera, Instant ultima) {
    }

    Totales totalesActor(long actorId, Instant desde) {
        return jdbc.queryForObject("""
                SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE estado >= 400) AS e,
                       MIN(ocurrido_en) AS primera, MAX(ocurrido_en) AS ultima
                FROM peticiones WHERE actor_id = ? AND ocurrido_en >= ?""",
                (rs, i) -> new Totales(rs.getLong("n"), rs.getLong("e"), instante(rs, "primera"),
                        instante(rs, "ultima")),
                actorId, OffsetDateTime.ofInstant(desde, ZoneOffset.UTC));
    }

    /** Dias de calendario en {@code zona} (YYYY-MM-DD), no en UTC: un 23:30 local no cae en el dia siguiente. */
    List<Conteo> porDiaActor(long actorId, Instant desde, ZoneId zona) {
        return jdbc.query("""
                SELECT to_char(ocurrido_en AT TIME ZONE ?, 'YYYY-MM-DD') AS etiqueta, COUNT(*) AS valor
                FROM peticiones WHERE actor_id = ? AND ocurrido_en >= ?
                GROUP BY 1 ORDER BY 1""",
                (rs, i) -> new Conteo(rs.getString("etiqueta"), rs.getLong("valor")),
                zona.getId(), actorId, OffsetDateTime.ofInstant(desde, ZoneOffset.UTC));
    }

    List<Conteo> rutasActor(long actorId, Instant desde) {
        return conteos("""
                SELECT metodo || ' ' || ruta AS etiqueta, COUNT(*) AS valor
                FROM peticiones WHERE actor_id = ? AND ocurrido_en >= ?
                GROUP BY 1 ORDER BY 2 DESC LIMIT 10""", actorId, desde);
    }

    List<Conteo> ipsActor(long actorId, Instant desde) {
        return conteos("""
                SELECT COALESCE(host(ip), '—') AS etiqueta, COUNT(*) AS valor
                FROM peticiones WHERE actor_id = ? AND ocurrido_en >= ?
                GROUP BY 1 ORDER BY 2 DESC LIMIT 10""", actorId, desde);
    }

    List<Conteo> estadosActor(long actorId, Instant desde) {
        return conteos("""
                SELECT (estado / 100)::text || 'xx' AS etiqueta, COUNT(*) AS valor
                FROM peticiones WHERE actor_id = ? AND ocurrido_en >= ?
                GROUP BY 1 ORDER BY 1""", actorId, desde);
    }

    private List<Conteo> conteos(String sql, long actorId, Instant desde) {
        return jdbc.query(sql, (rs, i) -> new Conteo(rs.getString("etiqueta"), rs.getLong("valor")),
                actorId, OffsetDateTime.ofInstant(desde, ZoneOffset.UTC));
    }

    private static Instant instante(ResultSet rs, String col) throws SQLException {
        OffsetDateTime t = rs.getObject(col, OffsetDateTime.class);
        return t == null ? null : t.toInstant();
    }

    private static Peticion mapear(ResultSet rs, int fila) throws SQLException {
        long actor = rs.getLong("actor_id");
        Long actorId = rs.wasNull() ? null : actor;
        return new Peticion(rs.getLong("id"), instante(rs, "ocurrido_en"), rs.getString("metodo"),
                rs.getString("ruta"), rs.getString("uri"), rs.getInt("estado"), rs.getLong("duracion_ms"),
                actorId, rs.getString("actor_usuario"), rs.getString("ip"), rs.getString("user_agent"),
                rs.getString("id_correlacion"));
    }
}
