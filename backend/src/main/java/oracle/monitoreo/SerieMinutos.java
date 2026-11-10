package oracle.monitoreo;

/**
 * Anillo de 60 cubetas de un minuto. Cada cubeta sabe a que minuto
 * pertenece: si al escribir encuentra un minuto viejo, se reinicia (no hace
 * falta un hilo de limpieza). Bloqueo por cubeta: la contencion es minima.
 */
final class SerieMinutos {

    static final int MINUTOS = 60;

    private final Cubeta[] cubetas = new Cubeta[MINUTOS];

    SerieMinutos() {
        for (int i = 0; i < MINUTOS; i++) {
            cubetas[i] = new Cubeta();
        }
    }

    void registrar(long minuto, int estado, long ms) {
        cubetas[(int) (minuto % MINUTOS)].registrar(minuto, estado, ms);
    }

    /** Acumula los minutos (desde, hasta] en {@code destino}. */
    void acumular(Agregado destino, long desde, long hasta) {
        for (Cubeta c : cubetas) {
            c.acumular(destino, desde, hasta);
        }
    }

    /** Agregado de un unico minuto. */
    Agregado minuto(long minuto) {
        Agregado a = new Agregado();
        cubetas[(int) (minuto % MINUTOS)].acumular(a, minuto - 1, minuto);
        return a;
    }

    private static final class Cubeta {
        private long minuto = -1;
        private long peticiones;
        private long errores4xx;
        private long errores5xx;
        private long sumaMs;
        private long maxMs;
        private final long[] hist = new long[Histograma.CUBETAS];

        synchronized void registrar(long m, int estado, long ms) {
            if (m < minuto) {
                return; // evento de hace >= 60 min (reloj atrasado): no pisa el minuto vigente
            }
            if (minuto != m) {
                minuto = m;
                peticiones = 0;
                errores4xx = 0;
                errores5xx = 0;
                sumaMs = 0;
                maxMs = 0;
                java.util.Arrays.fill(hist, 0);
            }
            peticiones++;
            if (estado >= 500) {
                errores5xx++;
            } else if (estado >= 400) {
                errores4xx++;
            }
            sumaMs += ms;
            maxMs = Math.max(maxMs, ms);
            hist[Histograma.indice(ms)]++;
        }

        synchronized void acumular(Agregado a, long desde, long hasta) {
            if (minuto <= desde || minuto > hasta) {
                return;
            }
            a.peticiones += peticiones;
            a.errores4xx += errores4xx;
            a.errores5xx += errores5xx;
            a.sumaMs += sumaMs;
            a.maxMs = Math.max(a.maxMs, maxMs);
            for (int i = 0; i < hist.length; i++) {
                a.cubetas[i] += hist[i];
            }
        }
    }
}
