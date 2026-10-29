package oracle.admin.request;

import jakarta.validation.constraints.NotNull;

/** Asignar un permiso a un rol. */
public record RolPermisoAsignarRequest(
        @NotNull(message = "El permiso es obligatorio.")
        Long permisoId) {
}
