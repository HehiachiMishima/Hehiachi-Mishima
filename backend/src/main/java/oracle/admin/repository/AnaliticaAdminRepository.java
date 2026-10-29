package oracle.admin.repository;

import java.util.List;
import oracle.admin.response.AnaliticaAdminResponse.Conteo;
import oracle.admin.response.AnaliticaAdminResponse.Kpis;
import oracle.common.response.PuntoSerie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Agregados ejecutivos del RBAC resueltos en MySQL sobre tablas y vistas de resolucion. */
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
                SELECT
                  (SELECT COUNT(*) FROM usuarios) AS usuarios,
                  (SELECT COUNT(*) FROM usuarios WHERE activo = TRUE) AS usuarios_activos,
                  (SELECT COUNT(*) FROM usuarios u
                     WHERE NOT EXISTS (SELECT 1 FROM usuarios_roles ur WHERE ur.usuario_id = u.id)) AS sin_rol,
                  (SELECT COUNT(*) FROM roles) AS roles,
                  (SELECT COUNT(*) FROM roles WHERE activo = TRUE) AS roles_activos,
                  (SELECT COUNT(*) FROM permisos) AS permisos,
                  (SELECT COUNT(*) FROM permisos WHERE activo = TRUE) AS permisos_activos,
                  (SELECT COUNT(*) FROM usuarios_permisos WHERE otorgado = TRUE) AS grants,
                  (SELECT COUNT(*) FROM usuarios_permisos WHERE otorgado = FALSE) AS denies
                """, (rs, n) -> new Kpis(rs.getLong("usuarios"), rs.getLong("usuarios_activos"),
                rs.getLong("sin_rol"), rs.getLong("roles"), rs.getLong("roles_activos"), rs.getLong("permisos"),
                rs.getLong("permisos_activos"), rs.getLong("grants"), rs.getLong("denies")));
    }

    public List<Conteo> usuariosPorRol() {
        return jdbc.query("""
                SELECT r.nombre AS etiqueta, COUNT(ur.usuario_id) AS valor
                FROM roles r
                LEFT JOIN usuarios_roles ur ON ur.rol_id = r.id
                GROUP BY r.id, r.nombre
                ORDER BY valor DESC, etiqueta ASC
                """, CONTEO);
    }

    /**
     * Usuario u tiene efectivamente el permiso p (deny-wins, respeta activo de
     * rol y permiso; mismo resultado que v_permisos_finales). Con EXISTS por
     * par el optimizador usa los PK de usuarios_roles / roles_permisos /
     * usuarios_permisos en lugar de materializar la vista completa.
     */
    private static final String TIENE_PERMISO = """
            ( EXISTS (SELECT 1 FROM roles_permisos rp
                      JOIN usuarios_roles ur ON ur.rol_id = rp.rol_id AND ur.usuario_id = u.id
                      JOIN roles r ON r.id = rp.rol_id AND r.activo = TRUE
                      WHERE rp.permiso_id = p.id)
              OR EXISTS (SELECT 1 FROM usuarios_permisos g
                         WHERE g.usuario_id = u.id AND g.permiso_id = p.id AND g.otorgado = TRUE) )
            AND NOT EXISTS (SELECT 1 FROM usuarios_permisos d
                            WHERE d.usuario_id = u.id AND d.permiso_id = p.id AND d.otorgado = FALSE)
            """;

    /** Permisos con mas usuarios que los tienen efectivamente (deny-wins aplicado). Va detras de la cache. */
    public List<Conteo> permisosMasOtorgados() {
        return jdbc.query("""
                SELECT p.nombre AS etiqueta, COUNT(*) AS valor
                FROM permisos p
                JOIN usuarios u
                WHERE p.activo = TRUE
                  AND %s
                GROUP BY p.id, p.nombre
                ORDER BY valor DESC, etiqueta ASC
                LIMIT %d
                """.formatted(TIENE_PERMISO, TOP_PERMISOS), CONTEO);
    }

    /** Usuarios ACTIVOS con acceso efectivo a cada panel (permisos PANEL_*). */
    public List<Conteo> coberturaPaneles() {
        return jdbc.query("""
                SELECT p.nombre AS etiqueta, COUNT(*) AS valor
                FROM permisos p
                JOIN usuarios u ON u.activo = TRUE
                WHERE p.activo = TRUE
                  AND p.nombre LIKE 'PANEL!_%%' ESCAPE '!'
                  AND %s
                GROUP BY p.nombre
                ORDER BY p.nombre
                """.formatted(TIENE_PERMISO), CONTEO);
    }

    /** Altas de usuarios por mes (ultimos 12): valor = altas, secundario = altas aun activas. */
    public List<PuntoSerie> altasPorMes() {
        return jdbc.query("""
                SELECT DATE_FORMAT(creado_en, '%%Y-%%m') AS periodo, COUNT(*) AS valor,
                       COALESCE(SUM(activo = TRUE), 0) AS secundario
                FROM usuarios
                WHERE creado_en >= DATE_SUB(DATE_FORMAT(CURRENT_DATE, '%%Y-%%m-01'), INTERVAL %d MONTH)
                GROUP BY periodo
                ORDER BY periodo
                """.formatted(MESES_ALTAS - 1),
                (rs, n) -> new PuntoSerie(rs.getString("periodo"), rs.getLong("valor"), rs.getLong("secundario")));
    }
}
