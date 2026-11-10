package oracle.monitoreo;

import java.time.Instant;

/**
 * Una peticion HTTP ya respondida, tal como la ve el filtro de acceso.
 *
 * @param ruta plantilla del handler (p. ej. /api/usuarios/{id}); acota la cardinalidad
 * @param uri  ruta real SIN query string (nunca se guardan parametros: pueden llevar PII)
 */
public record PeticionRegistrada(
        Instant ocurridoEn,
        String metodo,
        String ruta,
        String uri,
        int estado,
        long duracionMs,
        Long actorId,
        String actorUsuario,
        String ip,
        String userAgent,
        String idCorrelacion) {

    public boolean esError() {
        return estado >= 400;
    }
}
