package oracle.admin.request;

import jakarta.validation.constraints.Size;

/** Cierre forzado de sesiones; motivo (opcional) queda en detalle.motivo de la bitacora. */
public record CerrarSesionesRequest(
        @Size(max = 200, message = "El motivo no puede superar 200 caracteres.")
        String motivo) {
}
