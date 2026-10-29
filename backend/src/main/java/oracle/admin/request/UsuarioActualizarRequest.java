package oracle.admin.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import oracle.common.validation.ContrasenaSegura;

/**
 * Actualizacion parcial de usuario: campos null = no se tocan.
 * Se valida regla de negocio de unicidad en el service.
 */
public record UsuarioActualizarRequest(
        @Size(max = 50, message = "El usuario no puede superar 50 caracteres.") String usuario,
        @ContrasenaSegura String contrasena,
        @Size(max = 100, message = "El nombre no puede superar 100 caracteres.") String nombre,
        @Size(max = 100, message = "El apellido no puede superar 100 caracteres.") String apellido,
        @Email(message = "El correo electrónico no es válido.")
        @Size(max = 100, message = "El correo electrónico no puede superar 100 caracteres.") String email,
        @Size(max = 20, message = "El teléfono no puede superar 20 caracteres.") String telefono,
        Boolean activo) {
}
