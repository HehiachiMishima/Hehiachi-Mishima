package oracle.auditoria;

import java.time.Instant;
import tools.jackson.databind.JsonNode;

/** Evento de la bitacora tal como lo consume la UI (detalle = objeto JSON o null). */
public record AuditoriaEventoResponse(
        Long id,
        Instant ocurridoEn,
        Long actorId,
        String actorUsuario,
        String accion,
        String entidad,
        String entidadId,
        String resultado,
        String ip,
        String userAgent,
        String idCorrelacion,
        JsonNode detalle) {
}
