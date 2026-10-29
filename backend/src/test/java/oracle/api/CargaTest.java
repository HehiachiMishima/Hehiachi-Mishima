package oracle.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.IntFunction;
import oracle.soporte.ApiPrueba;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Prueba ligera de carga/concurrencia. NO forma parte del build por defecto:
 *
 *   ./mvnw -B test -Dtest=CargaTest -Dcarga=true -Dpruebas.bcrypt-coste=10 -Dsurefire.failIfNoSpecifiedTests=false
 *
 * Lanza N peticiones simultaneas (barrera de salida comun) por escenario y
 * reporta p50/p95/p99/max. Escribe target/carga-informe.txt. Solo falla ante
 * errores (no 2xx) o un p95 patologico (> 5 s lecturas, > 20 s logins): el SLA de 200 ms se REPORTA,
 * porque depende de la maquina y de BCRYPT_COSTE.
 */
@Tag("carga")
@EnabledIfSystemProperty(named = "carga", matches = "true")
class CargaTest extends ApiPrueba {

    private static final int N = Integer.getInteger("carga.n", 200);

    record Resultado(String escenario, int n, int ok, int errores, double p50, double p95, double p99, double max,
            double totalMs) {
        String linea() {
            return String.format(Locale.ROOT,
                    "%-34s n=%d ok=%d err=%d  p50=%.0fms p95=%.0fms p99=%.0fms max=%.0fms  total=%.0fms (%.0f req/s)",
                    escenario, n, ok, errores, p50, p95, p99, max, totalMs, n * 1000.0 / totalMs);
        }
    }

    private Resultado rafaga(String escenario, IntFunction<Respuesta> peticion) throws Exception {
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<long[]>> futuros = new ArrayList<>();
        long inicio;
        try (ExecutorService ex = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int i = 0; i < N; i++) {
                int idx = i;
                futuros.add(ex.submit(() -> {
                    salida.await();
                    long t0 = System.nanoTime();
                    Respuesta r = peticion.apply(idx);
                    return new long[] {System.nanoTime() - t0, r.status()};
                }));
            }
            inicio = System.nanoTime();
            salida.countDown();
        }
        double total = (System.nanoTime() - inicio) / 1e6;
        List<Double> ms = new ArrayList<>();
        int ok = 0;
        for (Future<long[]> f : futuros) {
            long[] v = f.get();
            ms.add(v[0] / 1e6);
            if (v[1] == 200 || v[1] == 204) {
                ok++;
            }
        }
        Collections.sort(ms);
        return new Resultado(escenario, N, ok, N - ok, pct(ms, 50), pct(ms, 95), pct(ms, 99), ms.get(ms.size() - 1),
                total);
    }

    private static double pct(List<Double> ordenado, int p) {
        int idx = (int) Math.ceil(p / 100.0 * ordenado.size()) - 1;
        return ordenado.get(Math.max(0, Math.min(idx, ordenado.size() - 1)));
    }

    @Test
    void concurrenciaDeLoginsYLecturas() throws Exception {
        UsuarioPrueba u = crearUsuario("VER_USUARIOS", "VER_ROLES", "VER_PERMISOS");
        String tokenAdmin = admin();
        // Calentamiento (JIT, caches) y apertura de N conexiones keep-alive en el cliente:
        // sin esto la primera rafaga mide sobre todo el establecimiento de 200 conexiones TCP.
        for (int i = 0; i < 20; i++) {
            get("/api/usuarios/" + u.id(), u.token());
        }
        Resultado frio = rafaga("GET /api/health (en frio, conexiones nuevas)", i -> get("/api/health", null));
        rafaga("calentamiento", i -> get("/api/auth/sesion", u.token()));

        List<Resultado> r = new ArrayList<>();
        r.add(frio);
        r.add(rafaga("login (BCrypt, IPs distintas)", i -> intentarLogin(u.usuario(), u.contrasena(), ipNueva())));
        r.add(rafaga("GET /api/auth/sesion", i -> get("/api/auth/sesion", u.token())));
        r.add(rafaga("GET /api/usuarios/{id}", i -> get("/api/usuarios/" + u.id(), u.token())));
        r.add(rafaga("GET /api/roles", i -> get("/api/roles", u.token())));
        r.add(rafaga("GET /api/auditoria (pagina 25)", i -> get("/api/auditoria?tamano=25", tokenAdmin)));
        r.add(rafaga("GET /api/resolucion/.../efectivos",
                i -> get("/api/resolucion/usuarios/" + u.id() + "/efectivos", u.token())));

        StringBuilder informe = new StringBuilder("Prueba de carga: " + N + " peticiones simultaneas por escenario; "
                + "BCRYPT_COSTE=" + System.getProperty("pruebas.bcrypt-coste", "4") + "; MySQL 8.4 en Testcontainers; "
                + Runtime.getRuntime().availableProcessors() + " CPU\n");
        r.forEach(x -> informe.append(x.linea()).append('\n'));
        System.out.println("\n===== CARGA =====\n" + informe + "=================\n");
        Path destino = Path.of(System.getProperty("basedir", "."), "target", "carga-informe.txt");
        Files.createDirectories(destino.getParent());
        Files.writeString(destino, informe.toString(), StandardCharsets.UTF_8);

        for (Resultado x : r) {
            assertThat(x.errores()).as(x.linea()).isZero();
            // BCrypt es CPU-bound a proposito: 200 logins simultaneos se encolan.
            assertThat(x.p95()).as(x.linea()).isLessThan(x.escenario().startsWith("login") ? 20_000 : 5_000);
        }
        // El bloqueo/limitador no se disparo con logins correctos desde IPs distintas.
        assertThat(jdbc.queryForObject("SELECT intentos_fallidos FROM usuarios WHERE id = ?", Integer.class, u.id()))
                .isZero();
    }
}
