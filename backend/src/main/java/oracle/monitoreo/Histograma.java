package oracle.monitoreo;

/**
 * Cubetas de latencia fijas (ms). Los percentiles se estiman interpolando
 * dentro de la cubeta: error acotado y memoria constante (sin guardar cada
 * duracion), suficiente para un tablero de operacion.
 */
final class Histograma {

    static final long[] LIMITES = {5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000};
    static final int CUBETAS = LIMITES.length + 1;

    static int indice(long ms) {
        for (int i = 0; i < LIMITES.length; i++) {
            if (ms <= LIMITES[i]) {
                return i;
            }
        }
        return LIMITES.length;
    }

    /** Percentil q (0..1) a partir de las cubetas; maximo = tope de la ultima. */
    static long percentil(long[] cubetas, long total, long maximo, double q) {
        if (total == 0) {
            return 0;
        }
        long objetivo = Math.max(1, (long) Math.ceil(q * total));
        long acumulado = 0;
        for (int i = 0; i < cubetas.length; i++) {
            long enCubeta = cubetas[i];
            if (enCubeta > 0 && acumulado + enCubeta >= objetivo) {
                long inferior = i == 0 ? 0 : LIMITES[i - 1];
                long superior = i < LIMITES.length ? LIMITES[i] : Math.max(maximo, inferior);
                double fraccion = (double) (objetivo - acumulado) / enCubeta;
                return Math.min(maximo, Math.round(inferior + fraccion * (superior - inferior)));
            }
            acumulado += enCubeta;
        }
        return maximo;
    }

    private Histograma() {
    }
}
