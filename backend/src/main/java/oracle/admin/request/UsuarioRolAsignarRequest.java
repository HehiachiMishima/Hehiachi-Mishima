package oracle.admin.request;

import jakarta.validation.constraints.NotNull;

/** Asignar un rol a un usuario. */
public record UsuarioRolAsignarRequest(
        @NotNull(message = "El rol es obligatorio.")
        Long rolId) {
}
