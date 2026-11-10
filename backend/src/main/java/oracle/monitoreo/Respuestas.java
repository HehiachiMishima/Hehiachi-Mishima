package oracle.monitoreo;

import java.time.Instant;
import java.util.List;

/** Contratos JSON de /api/monitoreo (records anidados para no dispersar 10 archivos). */
public final class Respuestas {

    /** Indicadores de trafico de una ventana de N minutos. */
    public record Ventana(int minutos, long peticiones, double porMinuto, long errores4xx, long errores5xx,
            double tasaError5xx, long promedioMs, long p50Ms, long p95Ms, long p99Ms, long maxMs) {
    }

    /** Un minuto de la serie temporal (minuto = inicio del minuto, UTC). */
    public record Punto(Instant minuto, long peticiones, long errores4xx, long errores5xx, long promedioMs,
            long p95Ms, long maxMs) {
    }

    /** Estadistica de un endpoint (metodo + plantilla de ruta). */
    public record Ruta(String metodo, String ruta, long peticiones, long errores4xx, long errores5xx,
            long promedioMs, long p50Ms, long p95Ms, long maxMs) {
    }

    /** Una peticion (memoria o BD). id es null en las incidencias en memoria. */
    public record Peticion(Long id, Instant ocurridoEn, String metodo, String ruta, String uri, int estado,
            long duracionMs, Long actorId, String actorUsuario, String ip, String userAgent, String idCorrelacion) {

        static Peticion de(PeticionRegistrada p) {
            return new Peticion(null, p.ocurridoEn(), p.metodo(), p.ruta(), p.uri(), p.estado(), p.duracionMs(),
                    p.actorId(), p.actorUsuario(), p.ip(), p.userAgent(), p.idCorrelacion());
        }
    }

    /** Ultimos errores y peticiones lentas (memoria del proceso, se pierden al reiniciar). */
    public record Incidencias(long umbralLentoMs, List<Peticion> errores, List<Peticion> lentas) {
    }

    /** Usuario visto recientemente en la API. */
    public record Presencia(Long actorId, String usuario, Instant primeraVez, Instant ultimaVez, String ip,
            String userAgent, String ultimaRuta, long peticiones, long errores) {
    }

    public record Jvm(long heapUsadoBytes, long heapMaxBytes, long noHeapUsadoBytes, double cpuProceso,
            double cpuSistema, int procesadores, int hilos, int hilosPico, long gcConteo, long gcTiempoMs,
            String version) {
    }

    /** latenciaMs = ida y vuelta de un SELECT 1; pool* = HikariCP. Null si no se pudo medir. */
    public record BaseDatos(boolean disponible, Long latenciaMs, Integer poolActivas, Integer poolInactivas,
            Integer poolTotal, Integer poolEsperando, Integer poolMaximo, Long tamanoBytes,
            Integer conexionesServidor) {
    }

    public record Colas(long auditoriaPendientes, long auditoriaDescartados, long trazasPendientes,
            long trazasDescartadas, boolean trazasPersistidas, int retencionDias) {
    }

    /** estado: OPERATIVO | DEGRADADO | CAIDO; alertas en lenguaje llano. */
    public record Sistema(String estado, List<String> alertas, Instant iniciadoEn, long uptimeSegundos,
            int enVuelo, Jvm jvm, BaseDatos baseDatos, Colas colas) {
    }

    public record Resumen(Instant generadoEn, Sistema sistema, Ventana ventana, Ventana ultimos5,
            int usuariosActivos) {
    }

    public record Conteo(String etiqueta, long valor) {
    }

    /** Lo que hizo un usuario en los ultimos N dias segun la traza persistida. */
    public record ActividadUsuario(Long actorId, int dias, long peticiones, long errores, Instant primera,
            Instant ultima, List<Conteo> porDia, List<Conteo> rutas, List<Conteo> ips, List<Conteo> estados) {
    }

    private Respuestas() {
    }
}
