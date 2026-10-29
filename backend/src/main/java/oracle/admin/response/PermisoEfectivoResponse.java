package oracle.admin.response;

import java.util.List;

/**
 * Aporte de una fuente al permiso del usuario, antes de MIN() (deny-wins).
 * origen = ROL (otorgado siempre TRUE; roles = roles activos que lo conceden)
 * u OVERRIDE (otorgado = grant/deny individual; roles vacio).
 */
public record PermisoEfectivoResponse(Long usuarioId, Long permisoId, Boolean otorgado, String origen,
        List<String> roles) {
}
