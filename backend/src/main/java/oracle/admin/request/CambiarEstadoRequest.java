package oracle.admin.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Conmutador de estado activo (kill switch) para usuario, rol o permiso.
 * motivo (opcional) queda en detalle.motivo de la bitacora.
 */
public record CambiarEstadoRequest(
        @NotNull(message = "El estado activo es obligatorio.")
        Boolean activo,

        @Size(max = 200, message = "El motivo no puede superar 200 caracteres.")
        String motivo) {
}
