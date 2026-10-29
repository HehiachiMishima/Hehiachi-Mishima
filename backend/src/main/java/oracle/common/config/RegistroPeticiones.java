package oracle.common.config;

import jakarta.servlet.AsyncEvent;
import jakarta.servlet.AsyncListener;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Traza cada peticion HTTP (metodo, ruta, estado y duracion en ms) e inyecta el
 * correlation-id en el MDC (y en la cabecera X-Request-Id) para poder cruzar
 * todas las lineas de log de una misma peticion.
 *
 * Los controllers devuelven Mono, de modo que la respuesta se completa en un
 * dispatch ASYNC posterior. Por eso, cuando la peticion entra en modo async, el
 * registro se hace en un AsyncListener (con el estado y la duracion reales) en
 * lugar del finally del filtro. No registra la query string para no volcar PII.
 *
 * El X-Request-Id entrante solo se acepta si cumple [A-Za-z0-9_-]{1,64} (mismo
 * largo que auditoria_eventos.id_correlacion): un valor mas largo o con otros
 * caracteres haria fallar el INSERT de la bitacora o permitiria log forging,
 * asi que se sustituye por un UUID. Siempre se devuelve en la respuesta.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RegistroPeticiones extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RegistroPeticiones.class);

    public static final String CABECERA_CORRELACION = "X-Request-Id";
    /** Clave del MDC (sale como campo "requestId" en los logs JSON). */
    public static final String MDC_CORRELACION = "requestId";
    /** Atributo de la peticion con el id resuelto (lo lee la bitacora en dispatch async). */
    public static final String ATRIBUTO_CORRELACION = RegistroPeticiones.class.getName() + ".correlacion";
    private static final Pattern CORRELACION_VALIDA = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");

    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;
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
        try {
            cadena.doFilter(peticion, respuesta);
        } finally {
            if (peticion.isAsyncStarted()) {
                registrarAlCompletarAsync(peticion, respuesta, inicio, correlacion);
            } else {
                registrar(peticion, respuesta, inicio);
                MDC.remove(MDC_CORRELACION);
            }
        }
    }

    private void registrarAlCompletarAsync(
            HttpServletRequest peticion, HttpServletResponse respuesta, long inicio, String correlacion) {
        try {
            peticion.getAsyncContext().addListener(new AsyncListener() {
                @Override
                public void onComplete(AsyncEvent evento) {
                    registrarConContexto(peticion, respuesta, inicio, correlacion);
                }

                @Override
                public void onTimeout(AsyncEvent evento) {
                    registrarConContexto(peticion, respuesta, inicio, correlacion);
                }

                @Override
                public void onError(AsyncEvent evento) {
                    registrarConContexto(peticion, respuesta, inicio, correlacion);
                }

                @Override
                public void onStartAsync(AsyncEvent evento) {
                    // Sin accion: ya estamos trazando este dispatch.
                }
            });
        } catch (IllegalStateException ex) {
            registrar(peticion, respuesta, inicio);
        }
    }

    private void registrarConContexto(
            HttpServletRequest peticion, HttpServletResponse respuesta, long inicio, String correlacion) {
        String previo = MDC.get(MDC_CORRELACION);
        MDC.put(MDC_CORRELACION, correlacion);
        try {
            registrar(peticion, respuesta, inicio);
        } finally {
            if (previo == null) {
                MDC.remove(MDC_CORRELACION);
            } else {
                MDC.put(MDC_CORRELACION, previo);
            }
        }
    }

    private void registrar(HttpServletRequest peticion, HttpServletResponse respuesta, long inicio) {
        long ms = (System.nanoTime() - inicio) / 1_000_000L;
        log.info("{} {} -> {} ({} ms)", peticion.getMethod(), peticion.getRequestURI(), respuesta.getStatus(), ms);
    }

    private String resolverCorrelacion(HttpServletRequest peticion) {
        Object previo = peticion.getAttribute(ATRIBUTO_CORRELACION);
        if (previo instanceof String ya) {
            return ya; // dispatch async: se conserva el id del dispatch original
        }
        String entrante = peticion.getHeader(CABECERA_CORRELACION);
        if (entrante != null && CORRELACION_VALIDA.matcher(entrante).matches()) {
            return entrante;
        }
        return UUID.randomUUID().toString();
    }
}
