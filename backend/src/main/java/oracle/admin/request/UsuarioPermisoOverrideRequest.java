package oracle.admin.request;

import jakarta.validation.constraints.NotNull;

/**
 * Override individual sobre un permiso: otorgado=true (grant) o false (deny).
 * Resuelve por MIN(otorgado) => deny-overrides.
 */
public record UsuarioPermisoOverrideRequest(
        @NotNull(message = "El permiso es obligatorio.")
        Long permisoId,

        @NotNull(message = "Indica si el permiso se concede (true) o se deniega (false).")
        Boolean otorgado) {
}
