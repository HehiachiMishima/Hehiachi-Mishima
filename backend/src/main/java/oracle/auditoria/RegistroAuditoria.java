package oracle.auditoria;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

/**
 * Escritor asincrono de la bitacora.
 *
 * <ul>
 *   <li>registrar() NUNCA lanza ni bloquea: serializa el detalle, trunca los
 *       campos al largo de la columna y encola. Si hay transaccion activa, un
 *       EXITO se encola solo tras el COMMIT (un rollback no deja un EXITO falso).</li>
 *   <li>Un hilo escritor vacia la cola en lotes (INSERT por batch).</li>
 *   <li>Cola acotada: si se llena, el evento se descarta, se cuenta en la metrica
 *       auditoria.eventos{estado=descartado} y queda una linea ERROR en el log.</li>
 *   <li>Si el INSERT falla, se reintenta fila a fila y cada fila perdida queda
 *       en el log (accion, actor, entidad) para no perder el rastro.</li>
 * </ul>
 */
@Component
public class RegistroAuditoria {

    private static final Logger log = LoggerFactory.getLogger(RegistroAuditoria.class);

    private final AuditoriaRepository repositorio;
    private final ObjectMapper json;
    private final BlockingQueue<EventoAuditoria> cola;
    private final int tamanoLote;
    private final Thread escritor;
    private volatile boolean activo = true;

    private final Counter encolados;
    private final Counter escritos;
    private final Counter descartados;
    private final Counter fallidos;

    public RegistroAuditoria(
            AuditoriaRepository repositorio,
            ObjectMapper json,
            MeterRegistry metricas,
            @Value("${app.auditoria.capacidad-cola:10000}") int capacidad,
            @Value("${app.auditoria.tamano-lote:200}") int tamanoLote) {
        this.repositorio = repositorio;
        this.json = json;
        this.cola = new ArrayBlockingQueue<>(capacidad);
        this.tamanoLote = tamanoLote;
        this.encolados = contador(metricas, "encolado");
        this.escritos = contador(metricas, "escrito");
        this.descartados = contador(metricas, "descartado");
        this.fallidos = contador(metricas, "fallido");
        Gauge.builder("auditoria.cola.tamano", cola, BlockingQueue::size)
                .description("Eventos de auditoria pendientes de escribir")
                .register(metricas);
        this.escritor = Thread.ofPlatform().name("auditoria-escritor").daemon(true).unstarted(this::bucle);
        this.escritor.start();
    }

    private static Counter contador(MeterRegistry metricas, String estado) {
        return Counter.builder("auditoria.eventos").tag("estado", estado)
                .description("Eventos de auditoria por estado").register(metricas);
    }

    /** Evento de exito. */
    public void exito(ContextoAuditoria ctx, AccionAuditoria accion, EntidadAuditoria entidad, Object entidadId,
            Map<String, ?> detalle) {
        registrar(ctx, accion, entidad, entidadId, ResultadoAuditoria.EXITO, detalle);
    }

    /** Registra un evento sin bloquear ni propagar errores. */
    public void registrar(ContextoAuditoria ctx, AccionAuditoria accion, EntidadAuditoria entidad, Object entidadId,
            ResultadoAuditoria resultado, Map<String, ?> detalle) {
        try {
            EventoAuditoria evento = construir(ctx, accion, entidad, entidadId, resultado, detalle);
            // Solo los EXITO esperan al COMMIT; un FALLO/DENEGADO describe un intento y
            // debe quedar aunque la transaccion se revierta por la propia excepcion.
            if (resultado == ResultadoAuditoria.EXITO && TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        encolar(evento);
                    }
                });
            } else {
                encolar(evento);
            }
        } catch (RuntimeException ex) {
            fallidos.increment();
            log.error("No se pudo preparar el evento de auditoria {} (actor={}): {}",
                    accion, ctx == null ? null : ctx.actorId(), ex.getMessage());
        }
    }

    private EventoAuditoria construir(ContextoAuditoria ctx, AccionAuditoria accion, EntidadAuditoria entidad,
            Object entidadId, ResultadoAuditoria resultado, Map<String, ?> detalle) {
        ContextoAuditoria c = ctx == null ? new ContextoAuditoria(null, null, null, null, null) : ctx;
        return new EventoAuditoria(
                Instant.now(),
                c.actorId(),
                truncar(c.actorUsuario(), 100),
                accion.name(),
                entidad == null ? null : entidad.name(),
                truncar(entidadId == null ? null : String.valueOf(entidadId), 64),
                resultado.name(),
                truncar(c.ip(), 45),
                truncar(c.userAgent(), 255),
                truncar(c.idCorrelacion(), 64),
                detalle == null ? null : json.writeValueAsString(detalle));
    }

    private void encolar(EventoAuditoria evento) {
        if (activo && cola.offer(evento)) {
            encolados.increment();
            return;
        }
        descartados.increment();
        log.error("Bitacora saturada: evento descartado accion={} actor={} entidad={}:{}",
                evento.accion(), evento.actorId(), evento.entidad(), evento.entidadId());
    }

    private void bucle() {
        List<EventoAuditoria> lote = new ArrayList<>(tamanoLote);
        while (activo || !cola.isEmpty()) {
            try {
                EventoAuditoria primero = cola.poll(500, TimeUnit.MILLISECONDS);
                if (primero == null) {
                    continue;
                }
                lote.add(primero);
                cola.drainTo(lote, tamanoLote - 1);
                escribir(lote);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return;
            } catch (RuntimeException ex) {
                log.error("Error inesperado en el escritor de auditoria", ex);
            } finally {
                lote.clear();
            }
        }
    }

    private void escribir(List<EventoAuditoria> lote) {
        try {
            repositorio.insertar(lote);
            escritos.increment(lote.size());
        } catch (RuntimeException ex) {
            log.error("Fallo el INSERT por lote de auditoria ({} eventos); se reintenta fila a fila: {}",
                    lote.size(), ex.getMessage());
            for (EventoAuditoria e : lote) {
                try {
                    repositorio.insertar(List.of(e));
                    escritos.increment();
                } catch (RuntimeException fila) {
                    fallidos.increment();
                    log.error("Evento de auditoria perdido accion={} actor={} usuario={} entidad={}:{} resultado={}: {}",
                            e.accion(), e.actorId(), e.actorUsuario(), e.entidad(), e.entidadId(), e.resultado(),
                            fila.getMessage());
                }
            }
        }
    }

    /** Apagado ordenado: deja de aceptar eventos y vacia la cola (max. 5 s). */
    @PreDestroy
    void cerrar() throws InterruptedException {
        activo = false;
        escritor.join(5_000);
        if (!cola.isEmpty()) {
            log.error("Se perdieron {} eventos de auditoria pendientes al apagar.", cola.size());
        }
    }

    private static String truncar(String v, int max) {
        if (v == null) {
            return null;
        }
        String limpio = v.replaceAll("[\\p{Cntrl}&&[^\\t]]", " ");
        return limpio.length() > max ? limpio.substring(0, max) : limpio;
    }
}
