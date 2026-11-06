package oracle.common.support;

import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.stereotype.Component;

/**
 * Ejecutor de consultas analiticas (dashboards).
 *
 * Cada dashboard lanza varias agregaciones independientes; aqui corren en
 * paralelo en hilos virtuales (latencia ~ la consulta mas lenta, no la suma),
 * pero un semaforo GLOBAL limita a {@code app.analitica.paralelismo} las
 * consultas analiticas simultaneas en todo el nodo. Asi un pico de dashboards
 * nunca agota el pool de conexiones que necesitan los CRUD.
 */
@Component
public class EjecutorAnalitica {

    private final ExecutorService hilos = Executors.newThreadPerTaskExecutor(
            Thread.ofVirtual().name("analitica-", 0).factory());
    private final Semaphore cupos;
    private final long limiteMs;

    public EjecutorAnalitica(
            @Value("${app.analitica.paralelismo:4}") int paralelismo,
            @Value("${app.analitica.timeout-ms:12000}") long timeoutMs) {
        this.cupos = new Semaphore(Math.max(1, paralelismo), true);
        this.limiteMs = timeoutMs;
    }

    /**
     * Ejecuta las consultas en paralelo (acotado) y devuelve sus resultados en
     * el mismo orden. Si alguna falla o se supera el tiempo, cancela el resto.
     */
    public List<Object> todas(List<Supplier<?>> consultas) {
        var mdc = MDC.getCopyOfContextMap();
        List<Future<Object>> tareas = consultas.stream()
                .map(c -> hilos.submit(() -> conCupo(c, mdc)))
                .toList();
        long fin = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(limiteMs);
        try {
            return tareas.stream().map(t -> esperar(t, fin)).toList();
        } finally {
            tareas.forEach(t -> t.cancel(true));
        }
    }

    private Object conCupo(Supplier<?> consulta, java.util.Map<String, String> mdc) throws InterruptedException {
        if (mdc != null) {
            MDC.setContextMap(mdc);
        }
        cupos.acquire();
        try {
            return consulta.get();
        } finally {
            cupos.release();
            MDC.clear();
        }
    }

    private static Object esperar(Future<Object> tarea, long finNanos) {
        try {
            return tarea.get(Math.max(0, finNanos - System.nanoTime()), TimeUnit.NANOSECONDS);
        } catch (TimeoutException | CancellationException ex) {
            throw new QueryTimeoutException("Las consultas del dashboard superaron el tiempo máximo.", ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Consulta analitica interrumpida.", ex);
        } catch (ExecutionException ex) {
            if (ex.getCause() instanceof RuntimeException r) {
                throw r;
            }
            throw new IllegalStateException(ex.getCause());
        }
    }

    @PreDestroy
    void cerrar() {
        hilos.shutdownNow();
    }
}
