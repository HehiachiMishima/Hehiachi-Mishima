package oracle.admin.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import oracle.common.validation.ContrasenaSegura;

/** Alta de usuario. */
public record UsuarioCrearRequest(
        @NotBlank(message = "El usuario es obligatorio.")
        @Size(max = 50, message = "El usuario no puede superar 50 caracteres.")
        String usuario,

        @NotBlank(message = "La contraseña es obligatoria.")
        @ContrasenaSegura
        String contrasena,

        @NotBlank(message = "El nombre es obligatorio.")
        @Size(max = 100, message = "El nombre no puede superar 100 caracteres.")
        String nombre,

        @NotBlank(message = "El apellido es obligatorio.")
        @Size(max = 100, message = "El apellido no puede superar 100 caracteres.")
        String apellido,

        @NotBlank(message = "El correo electrónico es obligatorio.")
        @Email(message = "El correo electrónico no es válido.")
        @Size(max = 100, message = "El correo electrónico no puede superar 100 caracteres.")
        String email,

        @Size(max = 20, message = "El teléfono no puede superar 20 caracteres.")
        String telefono,

        Boolean activo) {
}
