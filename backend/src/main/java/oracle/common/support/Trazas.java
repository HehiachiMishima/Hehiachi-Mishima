package oracle.common.support;

import java.util.function.Supplier;
import org.slf4j.Logger;

/**
 * Helper de trazabilidad: envuelve una operacion de service, registra su
 * duracion (DEBUG, o WARN si supera el umbral de lentitud) y propaga el error
 * (INFO para errores de negocio esperados, WARN para el resto). El nombre de la
 * operacion debe ser constante: nunca concatenar datos de entrada (log forging).
 * En produccion evita una linea INFO por operacion: el acceso ya lo traza
 * RegistroPeticiones.
 */
public final class Trazas {

    /** Operaciones por encima de este umbral se registran como WARN. */
    private static final long UMBRAL_LENTO_MS = 800;

    public static <T> T medir(Logger log, String operacion, Supplier<T> bloque) {
        long inicio = System.nanoTime();
        try {
            T resultado = bloque.get();
            long ms = milisegundos(inicio);
            if (ms >= UMBRAL_LENTO_MS) {
                log.warn("{} -> LENTO ({} ms)", operacion, ms);
            } else if (log.isDebugEnabled()) {
                log.debug("{} -> OK ({} ms)", operacion, ms);
            }
            return resultado;
        } catch (RuntimeException ex) {
            if (esDeNegocio(ex)) {
                // 4xx esperado (validacion, permiso, conflicto): sin mensaje para no volcar datos de entrada.
                log.info("{} -> {} ({} ms)", operacion, ex.getClass().getSimpleName(), milisegundos(inicio));
            } else {
                log.warn("{} -> ERROR ({} ms): {}", operacion, milisegundos(inicio), ex.toString());
            }
            throw ex;
        }
    }

    private static boolean esDeNegocio(RuntimeException ex) {
        return ex.getClass().getPackageName().equals("oracle.common.exception");
    }

    private static long milisegundos(long inicio) {
        return (System.nanoTime() - inicio) / 1_000_000L;
    }

    private Trazas() {
    }
}
