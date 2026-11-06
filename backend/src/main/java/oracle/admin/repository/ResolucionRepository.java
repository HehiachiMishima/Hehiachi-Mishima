package oracle.admin.repository;

import java.sql.Array;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import oracle.admin.response.PermisoEfectivoResponse;
import oracle.admin.response.PermisoFinalResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Consultas de resolucion de permisos sobre las vistas de PostgreSQL
 * (v_permisos_efectivos / v_permisos_finales, deny-wins con bool_and).
 * Al ser vistas (no entidades), se leen con JdbcTemplate.
 *
 * Regla de rendimiento: v_permisos_finales solo se consulta FILTRADA por
 * usuario_id (el planner empuja el predicado dentro de la vista). Los lotes
 * de ids viajan como UN parametro bigint[] (= ANY(?)): una sola sentencia
 * preparada para cualquier tamano de lote.
 */
@Repository
public class ResolucionRepository {

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
     * Aportes por permiso: una fila ROL (con el array de roles activos que lo
     * conceden) y una fila OVERRIDE si existe. Lee directamente la vista.
     */
    public List<PermisoEfectivoResponse> efectivos(Long usuarioId) {
        return jdbc.query("""
                SELECT usuario_id, permiso_id, otorgado, origen, roles
                FROM v_permisos_efectivos
                WHERE usuario_id = ?
                ORDER BY permiso_id, origen
                """, (rs, fila) -> new PermisoEfectivoResponse(
                        rs.getLong("usuario_id"),
                        rs.getLong("permiso_id"),
                        rs.getBoolean("otorgado"),
                        rs.getString("origen"),
                        textos(rs.getArray("roles"))), usuarioId);
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
                WHERE usuario_id = ? AND permitido
                ORDER BY permiso_id
                """, FINAL, usuarioId);
    }

    public boolean tienePermitido(Long usuarioId, Long permisoId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM v_permisos_finales
                               WHERE usuario_id = ? AND permiso_id = ? AND permitido)
                """, Boolean.class, usuarioId, permisoId));
    }

    /** Nombres permitidos via la funcion SQL inlinable app.permisos_de(). */
    public List<String> nombresPermitidos(Long usuarioId) {
        return jdbc.queryForList("SELECT nombre FROM permisos_de(?)", String.class, usuarioId);
    }

    /**
     * True si el usuario recibiria el permiso al activarlo (lo tiene en un rol
     * propio o como grant), ignorando el estado activo. Lo usa la regla
     * anti-escalada al reactivar permisos.
     */
    public boolean recibiriaPermiso(Long usuarioId, Long permisoId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM usuarios_roles ur
                               JOIN roles_permisos rp ON rp.rol_id = ur.rol_id
                               WHERE ur.usuario_id = ? AND rp.permiso_id = ?)
                    OR EXISTS (SELECT 1 FROM usuarios_permisos up
                               WHERE up.usuario_id = ? AND up.permiso_id = ? AND up.otorgado)
                """, Boolean.class, usuarioId, permisoId, usuarioId, permisoId));
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
                WHERE ur.usuario_id = ANY (?)
                ORDER BY ur.usuario_id, r.nombre
                """, ids);
    }

    /**
     * Permisos efectivos (permitido) para los ids dados. Con = ANY(?) el
     * predicado se empuja dentro de la vista (no la materializa entera).
     */
    public Map<Long, List<String>> permitidosPorUsuario(List<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return agrupar("""
                SELECT v.usuario_id AS usuario_id, p.nombre AS nombre
                FROM v_permisos_finales v
                JOIN permisos p ON p.id = v.permiso_id
                WHERE v.usuario_id = ANY (?) AND v.permitido
                ORDER BY v.usuario_id, p.nombre
                """, ids);
    }

    private Map<Long, List<String>> agrupar(String sql, List<Long> ids) {
        Map<Long, List<String>> mapa = new LinkedHashMap<>();
        jdbc.query(sql, rs -> {
            mapa.computeIfAbsent(rs.getLong("usuario_id"), k -> new ArrayList<>()).add(rs.getString("nombre"));
        }, (Object) ids.toArray(Long[]::new));
        return mapa;
    }

    private static List<String> textos(Array array) throws SQLException {
        if (array == null) {
            return List.of();
        }
        try {
            return Arrays.asList((String[]) array.getArray());
        } finally {
            array.free();
        }
    }
}
