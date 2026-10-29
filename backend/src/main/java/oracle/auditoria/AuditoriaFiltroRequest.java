package oracle.auditoria;

/**
 * Filtros de GET /api/auditoria y /api/auditoria/exportar (todos opcionales).
 * Fechas ISO-8601: con zona (2026-10-01T05:00:00Z, +offset) o sin ella, en cuyo
 * caso se interpretan en UTC (la columna es UTC). Una fecha sola (2026-10-01)
 * cubre el dia completo. accion, entidad y resultado admiten varios valores
 * separados por comas. relacionadoCon = TIPO:id (USUARIO:42, ROL:7, PERMISO:3).
 */
public record AuditoriaFiltroRequest(
        Integer pagina,
        Integer tamano,
        String desde,
        String hasta,
        Long actorId,
        String accion,
        String entidad,
        String entidadId,
        String resultado,
        String q,
        String relacionadoCon) {
}
