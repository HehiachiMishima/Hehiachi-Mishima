package oracle.admin.request;

import jakarta.validation.constraints.Size;

/** Actualizacion parcial de rol: campos null = no se tocan. */
public record RolActualizarRequest(
        @Size(max = 50, message = "El nombre no puede superar 50 caracteres.") String nombre,
        @Size(max = 200, message = "La descripción no puede superar 200 caracteres.") String descripcion,
        Boolean activo) {
}
