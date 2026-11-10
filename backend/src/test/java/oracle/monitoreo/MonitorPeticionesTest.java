package oracle.monitoreo;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

/** Pruebas unitarias del monitor en memoria (no necesitan BD ni Docker). */
class MonitorPeticionesTest {

    private static PeticionRegistrada p(String metodo, String ruta, int estado, long ms, Long actor) {
        return new PeticionRegistrada(Instant.now(), metodo, ruta, ruta, estado, ms, actor,
                actor == null ? null : "@u" + actor, "10.0.0.1", "JUnit", "corr");
    }

    @Test
    void percentilesInterpolanDentroDeLaCubeta() {
        long[] cubetas = new long[Histograma.CUBETAS];
        for (int i = 0; i < 100; i++) {
            cubetas[Histograma.indice(i < 90 ? 20 : 900)]++;
        }
        assertThat(Histograma.percentil(cubetas, 100, 900, 0.5)).isBetween(10L, 25L);
        assertThat(Histograma.percentil(cubetas, 100, 900, 0.95)).isBetween(500L, 900L);
        assertThat(Histograma.percentil(new long[Histograma.CUBETAS], 0, 0, 0.95)).isZero();
    }

    @Test
    void ventanaCuentaErroresYRutas() {
        MonitorPeticiones m = new MonitorPeticiones(1000);
        m.registrar(p("GET", "/api/usuarios", 200, 12, 1L));
        m.registrar(p("GET", "/api/usuarios", 200, 30, 1L));
        m.registrar(p("POST", "/api/usuarios", 400, 8, 2L));
        m.registrar(p("GET", "/api/roles/{id}", 500, 1500, null));

        var v = m.ventana(15);
        assertThat(v.peticiones()).isEqualTo(4);
        assertThat(v.errores4xx()).isEqualTo(1);
        assertThat(v.errores5xx()).isEqualTo(1);
        assertThat(v.maxMs()).isEqualTo(1500);

        assertThat(m.rutas(60)).first().satisfies(r -> {
            assertThat(r.metodo()).isEqualTo("GET");
            assertThat(r.ruta()).isEqualTo("/api/usuarios");
            assertThat(r.peticiones()).isEqualTo(2);
        });
        assertThat(m.errores()).hasSize(2);
        assertThat(m.lentas()).hasSize(1);
        assertThat(m.serie(60)).hasSize(60).last().satisfies(pt -> assertThat(pt.peticiones()).isEqualTo(4));
    }

    @Test
    void presenciaPorUsuarioYOlvido() {
        MonitorPeticiones m = new MonitorPeticiones(1000);
        m.registrar(p("GET", "/api/usuarios", 200, 5, 7L));
        m.registrar(p("DELETE", "/api/usuarios/{id}", 403, 5, 7L));
        assertThat(m.presentes(15)).singleElement().satisfies(pr -> {
            assertThat(pr.peticiones()).isEqualTo(2);
            assertThat(pr.errores()).isEqualTo(1);
            assertThat(pr.ultimaRuta()).isEqualTo("DELETE /api/usuarios/{id}");
        });
        m.olvidar(7L);
        assertThat(m.presentes(15)).isEmpty();
    }

    @Test
    void filtroDePeticionesAceptaElFormatoDelFrontend() {
        var f = new FiltroPeticiones("2026-11-10T13:00:00", "2026-11-10T14:00:00", null, null, null, null, null, null, 1, 25);
        var c = f.condicion(Instant.parse("2026-11-10T14:00:00Z"));
        assertThat(c.where()).contains("p.ocurrido_en >= ?").contains("p.ocurrido_en < ?");
    }

    @Test
    void sinDesdeSeAcotaASieteDiasAntesDeHasta() {
        var f = new FiltroPeticiones(null, "2026-01-31T00:00:00Z", null, null, null, null, null, null, 1, 25);
        var c = f.condicion(Instant.parse("2026-11-10T14:00:00Z"));
        assertThat(c.args().get(0)).isEqualTo(java.time.OffsetDateTime.parse("2026-01-24T00:00:00.000001Z"));
    }

    @Test
    void desdePosteriorAHastaEs400() {
        var f = new FiltroPeticiones("2026-11-10T15:00:00Z", "2026-11-10T14:00:00Z", null, null, null, null, null, null, 1, 25);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> f.condicion(Instant.now()))
                .isInstanceOf(oracle.common.exception.PeticionInvalidaException.class);
    }

    @Test
    void cubetaNoSeReiniciaConUnMinutoViejo() {
        SerieMinutos s = new SerieMinutos();
        s.registrar(1000, 200, 10);
        s.registrar(940, 500, 10); // mismo hueco (1000 % 60 == 940 % 60), una hora antes
        Agregado a = s.minuto(1000);
        assertThat(a.peticiones).isEqualTo(1);
        assertThat(a.errores5xx).isZero();
    }
}
