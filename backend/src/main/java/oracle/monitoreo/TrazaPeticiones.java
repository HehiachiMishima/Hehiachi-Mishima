package oracle.monitoreo;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Persiste cada peticion de la API en bitacora.peticiones sin frenar la
 * respuesta: encola (nunca bloquea) y un hilo escribe por lotes. Si la cola
 * se llena se descarta y se cuenta (monitoreo.trazas{estado=descartada}).
 *
 * No se persisten los GET de /api/monitoreo (el tablero se refresca cada
 * pocos segundos y ahogaria la traza); si cuentan en las metricas en memoria.
 * La purga diaria borra lo anterior a app.monitoreo.retencion-dias.
 */
@Component
public class TrazaPeticiones {

    private static final Logger log = LoggerFactory.getLogger(TrazaPeticiones.class);
    private static final int LOTE_PURGA = 5_000;

    private final PeticionesRepository repositorio;
    private final boolean persistir;
    private final int retencionDias;
    private final int tamanoLote;
    private final BlockingQueue<PeticionRegistrada> cola;
    private final Thread escritor;
    private volatile boolean activo = true;

    private final Counter escritas;
    private final Counter descartadas;
    private final Counter fallidas;

    public TrazaPeticiones(
            PeticionesRepository repositorio,
            MeterRegistry metricas,
            @Value("${app.monitoreo.persistir-peticiones:true}") boolean persistir,
            @Value("${app.monitoreo.retencion-dias:30}") int retencionDias,
            @Value("${app.monitoreo.capacidad-cola:20000}") int capacidad,
            @Value("${app.monitoreo.tamano-lote:500}") int tamanoLote) {
        this.repositorio = repositorio;
        this.persistir = persistir;
        this.retencionDias = Math.max(1, retencionDias);
        this.tamanoLote = tamanoLote;
        this.cola = new ArrayBlockingQueue<>(capacidad);
        this.escritas = contador(metricas, "escrita");
        this.descartadas = contador(metricas, "descartada");
        this.fallidas = contador(metricas, "fallida");
        Gauge.builder("monitoreo.trazas.cola", cola, BlockingQueue::size)
                .description("Trazas de peticiones pendientes de escribir").register(metricas);
        this.escritor = Thread.ofPlatform().name("trazas-escritor").daemon(true).unstarted(this::bucle);
        if (persistir) {
            this.escritor.start();
        }
    }

    private static Counter contador(MeterRegistry m, String estado) {
        return Counter.builder("monitoreo.trazas").tag("estado", estado)
                .description("Trazas de peticiones por estado").register(m);
    }

    public void registrar(PeticionRegistrada p) {
        if (!persistir || ("GET".equals(p.metodo()) && p.ruta().startsWith("/api/monitoreo"))) {
            return;
        }
        if (!activo || !cola.offer(p)) {
            descartadas.increment();
        }
    }

    public boolean persiste() {
        return persistir;
    }

    public int retencionDias() {
        return retencionDias;
    }

    public long pendientes() {
        return cola.size();
    }

    public long descartadas() {
        return (long) (descartadas.count() + fallidas.count());
    }

    private void bucle() {
        List<PeticionRegistrada> lote = new ArrayList<>(tamanoLote);
        while (activo || !cola.isEmpty()) {
            try {
                PeticionRegistrada primera = cola.poll(500, TimeUnit.MILLISECONDS);
                if (primera == null) {
                    continue;
                }
                lote.add(primera);
                cola.drainTo(lote, tamanoLote - 1);
                repositorio.insertar(lote);
                escritas.increment(lote.size());
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return;
            } catch (RuntimeException ex) {
                // La traza es best-effort: no se reintenta fila a fila (la auditoria si).
                fallidas.increment(lote.size());
                log.warn("No se pudo escribir un lote de {} trazas de peticiones: {}", lote.size(), ex.getMessage());
            } finally {
                lote.clear();
            }
        }
    }

    /** Purga por lotes cortos (no retiene bloqueos largos). Cada 6 h. */
    @Scheduled(initialDelayString = "${app.monitoreo.purga-inicial-ms:300000}", fixedDelay = 21_600_000)
    void purgar() {
        if (!persistir) {
            return;
        }
        Instant limite = Instant.now().minus(Duration.ofDays(retencionDias));
        long total = 0;
        try {
            int borradas;
            do {
                borradas = repositorio.purgar(limite, LOTE_PURGA);
                total += borradas;
            } while (borradas == LOTE_PURGA && activo);
            if (total > 0) {
                log.info("Purga de trazas: {} peticiones anteriores a {} eliminadas.", total, limite);
            }
        } catch (RuntimeException ex) {
            log.warn("Fallo la purga de trazas de peticiones: {}", ex.getMessage());
        }
    }

    @PreDestroy
    void cerrar() throws InterruptedException {
        activo = false;
        if (escritor.isAlive()) {
            escritor.join(5_000);
        }
    }
}
