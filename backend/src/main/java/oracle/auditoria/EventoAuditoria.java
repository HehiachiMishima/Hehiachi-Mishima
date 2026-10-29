package oracle.auditoria;

import java.time.Instant;

/** Fila lista para insertar: ya truncada y con el detalle serializado a JSON. */
record EventoAuditoria(
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
        String detalleJson) {
}
