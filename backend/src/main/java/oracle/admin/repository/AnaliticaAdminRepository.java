package oracle.admin.repository;

import java.util.List;
import oracle.admin.response.AnaliticaAdminResponse.Conteo;
import oracle.admin.response.AnaliticaAdminResponse.Kpis;
import oracle.common.response.PuntoSerie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Agregados ejecutivos del RBAC resueltos en PostgreSQL.
 *
 * <ul>
 *   <li>KPIs: una sola pasada por tabla con agregados FILTER (en lugar de una
 *       subconsulta COUNT por cifra).</li>
 *   <li>Permisos efectivos: se agregan sobre v_permisos_finales (deny-wins con
 *       bool_and) con HashAggregate; va detras de la cache del dashboard.</li>
 *   <li>Altas por mes: generate_series rellena los meses sin altas con 0, de
 *       modo que la serie siempre tiene 12 puntos consecutivos.</li>
 * </ul>
 */
@Repository
public class AnaliticaAdminRepository {

    private static final RowMapper<Conteo> CONTEO = (rs, n) -> new Conteo(rs.getString("etiqueta"), rs.getLong("valor"));
    private static final int TOP_PERMISOS = 12;
    private static final int MESES_ALTAS = 12;

    private final JdbcTemplate jdbc;

    public AnaliticaAdminRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Kpis kpis() {
        return jdbc.queryForObject("""
                WITH u AS (
                    SELECT count(*)                                  AS usuarios,
                           count(*) FILTER (WHERE activo)            AS usuarios_activos,
                           count(*) FILTER (WHERE NOT EXISTS (
                               SELECT 1 FROM usuarios_roles ur WHERE ur.usuario_id = usuarios.id)) AS sin_rol
                    FROM usuarios
                ), r AS (
                    SELECT count(*) AS roles, count(*) FILTER (WHERE activo) AS roles_activos FROM roles
                ), p AS (
                    SELECT count(*) AS permisos, count(*) FILTER (WHERE activo) AS permisos_activos FROM permisos
                ), o AS (
                    SELECT count(*) FILTER (WHERE otorgado)     AS grants,
                           count(*) FILTER (WHERE NOT otorgado) AS denies
                    FROM usuarios_permisos
                )
                SELECT u.*, r.*, p.*, o.* FROM u, r, p, o
                """, (rs, n) -> new Kpis(rs.getLong("usuarios"), rs.getLong("usuarios_activos"),
                rs.getLong("sin_rol"), rs.getLong("roles"), rs.getLong("roles_activos"), rs.getLong("permisos"),
                rs.getLong("permisos_activos"), rs.getLong("grants"), rs.getLong("denies")));
    }

    public List<Conteo> usuariosPorRol() {
        return jdbc.query("""
                SELECT r.nombre AS etiqueta, count(ur.usuario_id) AS valor
                FROM roles r
                LEFT JOIN usuarios_roles ur ON ur.rol_id = r.id
                GROUP BY r.id, r.nombre
                ORDER BY valor DESC, etiqueta
                """, CONTEO);
    }

    /** Permisos con mas usuarios que los tienen efectivamente (deny-wins aplicado). */
    public List<Conteo> permisosMasOtorgados() {
        return jdbc.query("""
                SELECT p.nombre AS etiqueta, count(*) AS valor
                FROM v_permisos_finales f
                JOIN permisos p ON p.id = f.permiso_id
                WHERE f.permitido
                GROUP BY p.id, p.nombre
                ORDER BY valor DESC, etiqueta
                LIMIT ?
                """, CONTEO, TOP_PERMISOS);
    }

    /** Usuarios ACTIVOS con acceso efectivo a cada panel (permisos PANEL_*). */
    public List<Conteo> coberturaPaneles() {
        return jdbc.query("""
                SELECT p.nombre AS etiqueta, count(u.id) AS valor
                FROM permisos p
                LEFT JOIN v_permisos_finales f ON f.permiso_id = p.id AND f.permitido
                LEFT JOIN usuarios u ON u.id = f.usuario_id AND u.activo
                WHERE p.activo AND p.nombre LIKE 'PANEL\\_%'
                GROUP BY p.nombre
                HAVING count(u.id) > 0
                ORDER BY p.nombre
                """, CONTEO);
    }

    /** Altas de usuarios por mes (ultimos 12): valor = altas, secundario = altas aun activas. */
    public List<PuntoSerie> altasPorMes() {
        return jdbc.query("""
                WITH meses AS (
                    SELECT generate_series(date_trunc('month', now()) - make_interval(months => ?),
                                           date_trunc('month', now()),
                                           interval '1 month') AS mes
                )
                SELECT to_char(m.mes, 'YYYY-MM')                AS periodo,
                       count(u.id)                              AS valor,
                       count(u.id) FILTER (WHERE u.activo)      AS secundario
                FROM meses m
                LEFT JOIN usuarios u
                       ON u.creado_en >= m.mes AND u.creado_en < m.mes + interval '1 month'
                GROUP BY m.mes
                ORDER BY m.mes
                """,
                (rs, n) -> new PuntoSerie(rs.getString("periodo"), rs.getLong("valor"), rs.getLong("secundario")),
                MESES_ALTAS - 1);
    }
}
