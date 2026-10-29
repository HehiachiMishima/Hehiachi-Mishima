package oracle.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import oracle.common.validation.ContrasenaSegura;

/** Cambio de la propia contrasena: exige la actual y la nueva. */
public record CambiarContrasenaRequest(
        @NotBlank(message = "La contraseña actual es obligatoria.")
        @Size(max = 100, message = "La contraseña actual no puede superar 100 caracteres.")
        String contrasenaActual,

        @NotBlank(message = "La contraseña nueva es obligatoria.")
        @ContrasenaSegura
        String contrasenaNueva) {
}
