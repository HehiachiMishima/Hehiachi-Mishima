package oracle.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Credenciales de acceso: acepta usuario o correo electronico en el mismo campo. */
public record LoginRequest(
        @NotBlank(message = "El usuario o correo electrónico es obligatorio.")
        @Size(max = 100, message = "El usuario no puede superar 100 caracteres.")
        String usuario,

        @NotBlank(message = "La contraseña es obligatoria.")
        @Size(max = 100, message = "La contraseña no puede superar 100 caracteres.")
        String contrasena) {
}
