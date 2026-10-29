package oracle.admin.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Alta de permiso. */
public record PermisoCrearRequest(
        @NotBlank(message = "El nombre del permiso es obligatorio.")
        @Size(max = 50, message = "El nombre no puede superar 50 caracteres.")
        String nombre,
        @Size(max = 200, message = "La descripción no puede superar 200 caracteres.") String descripcion,
        Boolean activo) {
}
