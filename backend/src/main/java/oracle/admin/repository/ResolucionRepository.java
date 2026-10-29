package oracle.admin.repository;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import oracle.admin.response.PermisoEfectivoResponse;
import oracle.admin.response.PermisoFinalResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Consultas de resolucion de permisos sobre las vistas de MySQL.
 * Al ser vistas (no entidades), se leen con JdbcTemplate y se mapean
 * directamente a las respuestas.
 *
 * Regla de rendimiento: v_permisos_finales solo se consulta FILTRADA por
 * usuario_id (MySQL empuja el predicado dentro de la vista). Las consultas
 * globales materializarian todos los pares usuario x permiso; por eso el
 * resumen trabaja por lotes de ids.
 */
@Repository
public class ResolucionRepository {

    /** Separador de GROUP_CONCAT que no puede aparecer en un nombre de rol. */
    private static final String SEPARADOR = "\u001F";

    private static final RowMapper<PermisoFinalResponse> FINAL = (rs, fila) ->
            new PermisoFinalResponse(
                    rs.getLong("usuario_id"),
                    rs.getLong("permiso_id"),
                    rs.getBoolean("permitido"));

    private final JdbcTemplate jdbc;

    public ResolucionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Aportes por permiso: una fila ROL (con los roles activos que lo conceden)
     * y una fila OVERRIDE si existe. Mismas reglas de activo que v_permisos_efectivos.
     */
    public List<PermisoEfectivoResponse> efectivos(Long usuarioId) {
        return jdbc.query("""
                SELECT ur.usuario_id, rp.permiso_id, TRUE AS otorgado, 'ROL' AS origen,
                       GROUP_CONCAT(r.nombre ORDER BY r.nombre SEPARATOR '%1$s') AS roles
                FROM usuarios_roles ur
                JOIN roles r ON r.id = ur.rol_id AND r.activo = TRUE
                JOIN roles_permisos rp ON rp.rol_id = ur.rol_id
                JOIN permisos p ON p.id = rp.permiso_id AND p.activo = TRUE
                WHERE ur.usuario_id = ?
                GROUP BY ur.usuario_id, rp.permiso_id
                UNION ALL
                SELECT up.usuario_id, up.permiso_id, up.otorgado, 'OVERRIDE' AS origen, NULL AS roles
                FROM usuarios_permisos up
                JOIN permisos p ON p.id = up.permiso_id AND p.activo = TRUE
                WHERE up.usuario_id = ?
                ORDER BY permiso_id, origen
                """.formatted(SEPARADOR), (rs, fila) -> {
                    String roles = rs.getString("roles");
                    return new PermisoEfectivoResponse(
                            rs.getLong("usuario_id"),
                            rs.getLong("permiso_id"),
                            rs.getBoolean("otorgado"),
                            rs.getString("origen"),
                            roles == null ? List.of() : Arrays.asList(roles.split(SEPARADOR)));
                }, usuarioId, usuarioId);
    }

    public List<PermisoFinalResponse> finales(Long usuarioId) {
        return jdbc.query("""
                SELECT usuario_id, permiso_id, permitido
                FROM v_permisos_finales
                WHERE usuario_id = ?
                ORDER BY permiso_id
                """, FINAL, usuarioId);
    }

    public List<PermisoFinalResponse> permitidos(Long usuarioId) {
        return jdbc.query("""
                SELECT usuario_id, permiso_id, permitido
                FROM v_permisos_finales
                WHERE usuario_id = ? AND permitido = TRUE
                ORDER BY permiso_id
                """, FINAL, usuarioId);
    }

    public boolean tienePermitido(Long usuarioId, Long permisoId) {
        Integer total = jdbc.queryForObject("""
                SELECT COUNT(*) FROM v_permisos_finales
                WHERE usuario_id = ? AND permiso_id = ? AND permitido = TRUE
                """, Integer.class, usuarioId, permisoId);
        return total != null && total > 0;
    }

    public List<String> nombresPermitidos(Long usuarioId) {
        return jdbc.queryForList("""
                SELECT p.nombre
                FROM v_permisos_finales v
                JOIN permisos p ON p.id = v.permiso_id
                WHERE v.usuario_id = ? AND v.permitido = TRUE
                ORDER BY p.nombre
                """, String.class, usuarioId);
    }

    /**
     * True si el usuario recibiria el permiso al activarlo (lo tiene en un rol
     * propio o como grant), ignorando el estado activo. Lo usa la regla
     * anti-escalada al reactivar permisos.
     */
    public boolean recibiriaPermiso(Long usuarioId, Long permisoId) {
        Integer total = jdbc.queryForObject("""
                SELECT (EXISTS (SELECT 1 FROM usuarios_roles ur
                                JOIN roles_permisos rp ON rp.rol_id = ur.rol_id
                                WHERE ur.usuario_id = ? AND rp.permiso_id = ?)
                     OR EXISTS (SELECT 1 FROM usuarios_permisos up
                                WHERE up.usuario_id = ? AND up.permiso_id = ? AND up.otorgado = TRUE))
                """, Integer.class, usuarioId, permisoId, usuarioId, permisoId);
        return total != null && total > 0;
    }

    /** Roles por usuario para los ids dados (usuario_id -> nombres). */
    public Map<Long, List<String>> rolesPorUsuario(List<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return agrupar("""
                SELECT ur.usuario_id AS usuario_id, r.nombre AS nombre
                FROM usuarios_roles ur
                JOIN roles r ON r.id = ur.rol_id
                WHERE ur.usuario_id IN (%s)
                ORDER BY ur.usuario_id, r.nombre
                """.formatted(marcadores(ids.size())), ids);
    }

    /**
     * Permisos efectivos (permitido = TRUE) para los ids dados. Con IN (...) el
     * predicado se empuja dentro de la vista (decenas de ms por cada 100 usuarios
     * frente a minutos al materializarla entera).
     */
    public Map<Long, List<String>> permitidosPorUsuario(List<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return agrupar("""
                SELECT v.usuario_id AS usuario_id, p.nombre AS nombre
                FROM v_permisos_finales v
                JOIN permisos p ON p.id = v.permiso_id
                WHERE v.usuario_id IN (%s) AND v.permitido = TRUE
                ORDER BY v.usuario_id, p.nombre
                """.formatted(marcadores(ids.size())), ids);
    }

    private Map<Long, List<String>> agrupar(String sql, List<Long> ids) {
        Map<Long, List<String>> mapa = new LinkedHashMap<>();
        jdbc.query(sql, rs -> {
            mapa.computeIfAbsent(rs.getLong("usuario_id"), k -> new ArrayList<>()).add(rs.getString("nombre"));
        }, ids.toArray());
        return mapa;
    }

    private static String marcadores(int n) {
        return String.join(",", Collections.nCopies(n, "?"));
    }
}
