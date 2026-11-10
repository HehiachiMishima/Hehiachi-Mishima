package oracle.common.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import oracle.monitoreo.InterceptorActor;
import oracle.monitoreo.MonitorPeticiones;
import oracle.monitoreo.PeticionRegistrada;
import oracle.monitoreo.TrazaPeticiones;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

/**
 * Traza cada peticion HTTP (metodo, ruta, estado y duracion en ms) e inyecta el
 * correlation-id en el MDC (y en la cabecera X-Request-Id) para poder cruzar
 * todas las lineas de log de una misma peticion.
 *
 * Los controllers son sincronos (Spring MVC + hilos virtuales): la respuesta
 * esta completa al volver de la cadena, asi que el registro va en el finally.
 * No registra la query string para no volcar PII.
 *
 * El X-Request-Id entrante solo se acepta si cumple [A-Za-z0-9_-]{1,64} (mismo
 * largo que auditoria_eventos.id_correlacion): un valor mas largo o con otros
 * caracteres haria fallar el INSERT de la bitacora o permitiria log forging,
 * asi que se sustituye por un UUID. Siempre se devuelve en la respuesta.
 *
 * Ademas alimenta el monitoreo: metricas en memoria (MonitorPeticiones) y la
 * traza persistida por usuario (TrazaPeticiones). Ambos son no bloqueantes.
 * Quedan fuera /api/health, /actuator y los OPTIONS (preflight CORS).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RegistroPeticiones extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RegistroPeticiones.class);

    public static final String CABECERA_CORRELACION = "X-Request-Id";
    /** Clave del MDC (sale como campo "requestId" en los logs JSON). */
    public static final String MDC_CORRELACION = "requestId";
    /** Atributo de la peticion con el id resuelto (lo lee la bitacora). */
    public static final String ATRIBUTO_CORRELACION = RegistroPeticiones.class.getName() + ".correlacion";
    private static final Pattern CORRELACION_VALIDA = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    private static final String SIN_RUTA = "(sin coincidencia)";

    private final MonitorPeticiones monitor;
    private final TrazaPeticiones traza;

    public RegistroPeticiones(MonitorPeticiones monitor, TrazaPeticiones traza) {
        this.monitor = monitor;
        this.traza = traza;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest peticion, HttpServletResponse respuesta, FilterChain cadena)
            throws ServletException, IOException {
        long inicio = System.nanoTime();
        String correlacion = resolverCorrelacion(peticion);
        peticion.setAttribute(ATRIBUTO_CORRELACION, correlacion);
        MDC.put(MDC_CORRELACION, correlacion);
        respuesta.setHeader(CABECERA_CORRELACION, correlacion);
        boolean medir = esMedible(peticion);
        if (medir) {
            monitor.entrar();
        }
        try {
            cadena.doFilter(peticion, respuesta);
        } finally {
            if (medir) {
                monitor.salir();
            }
            registrar(peticion, respuesta, inicio, correlacion, medir);
            MDC.remove(MDC_CORRELACION);
        }
    }

    private static boolean esMedible(HttpServletRequest peticion) {
        String uri = peticion.getRequestURI();
        return !"OPTIONS".equals(peticion.getMethod())
                && uri.startsWith("/api/")
                && !uri.equals("/api/health");
    }

    private void registrar(HttpServletRequest peticion, HttpServletResponse respuesta, long inicio,
            String correlacion, boolean medir) {
        long ms = (System.nanoTime() - inicio) / 1_000_000L;
        log.info("{} {} -> {} ({} ms)", peticion.getMethod(), peticion.getRequestURI(), respuesta.getStatus(), ms);
        if (!medir) {
            return;
        }
        try {
            Object patron = peticion.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
            Object actor = peticion.getAttribute(InterceptorActor.ATRIBUTO_ACTOR);
            InterceptorActor.Actor a = actor instanceof InterceptorActor.Actor x ? x : null;
            PeticionRegistrada p = new PeticionRegistrada(
                    Instant.now(),
                    peticion.getMethod(),
                    patron instanceof String ruta ? truncar(ruta, 200) : SIN_RUTA,
                    truncar(peticion.getRequestURI(), 500),
                    respuesta.getStatus(),
                    ms,
                    a == null ? null : a.id(),
                    a == null ? null : truncar(a.usuario(), 100),
                    truncar(peticion.getRemoteAddr(), 45),
                    truncar(peticion.getHeader("User-Agent"), 255),
                    correlacion);
            monitor.registrar(p);
            traza.registrar(p);
        } catch (RuntimeException ex) {
            log.warn("No se pudo registrar la peticion en el monitoreo: {}", ex.getMessage());
        }
    }

    private static String truncar(String v, int max) {
        if (v == null) {
            return null;
        }
        String limpio = v.replaceAll("[\\p{Cntrl}]", " ");
        return limpio.length() > max ? limpio.substring(0, max) : limpio;
    }

    private String resolverCorrelacion(HttpServletRequest peticion) {
        Object previo = peticion.getAttribute(ATRIBUTO_CORRELACION);
        if (previo instanceof String ya) {
            return ya; // dispatch de error: se conserva el id de la peticion original
        }
        String entrante = peticion.getHeader(CABECERA_CORRELACION);
        if (entrante != null && CORRELACION_VALIDA.matcher(entrante).matches()) {
            return entrante;
        }
        return UUID.randomUUID().toString();
    }
}
