package oracle.monitoreo;

/** Suma de cubetas de un periodo (no es thread-safe: se arma y se lee en un solo hilo). */
final class Agregado {

    long peticiones;
    long errores4xx;
    long errores5xx;
    long sumaMs;
    long maxMs;
    final long[] cubetas = new long[Histograma.CUBETAS];

    long promedioMs() {
        return peticiones == 0 ? 0 : Math.round((double) sumaMs / peticiones);
    }

    long percentil(double q) {
        return Histograma.percentil(cubetas, peticiones, maxMs, q);
    }

    double tasaError5xx() {
        return peticiones == 0 ? 0 : (double) errores5xx / peticiones;
    }
}
