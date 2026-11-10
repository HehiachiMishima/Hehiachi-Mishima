package oracle.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import oracle.soporte.ApiPrueba;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/** Monitoreo contra PostgreSQL real: traza persistida, filtros de fecha y actividad por usuario. */
class MonitoreoTest extends ApiPrueba {

    /** Mismo formato que isoUtc() del frontend: UTC sin la Z. */
    private static String isoUtc(Instant i) {
        return i.truncatedTo(ChronoUnit.SECONDS).toString().replace("Z", "");
    }

    @Test
    void laTrazaGuardaQuienHizoQueYSeFiltraConElFormatoDelFrontend() {
        UsuarioPrueba u = crearUsuario("VER_USUARIOS");
        esperarStatus(get("/api/usuarios", u.token()), 200);
        esperarStatus(get("/api/roles", u.token()), 403);

        String desde = isoUtc(Instant.now().minus(Duration.ofHours(1)));
        String hasta = isoUtc(Instant.now().plus(Duration.ofMinutes(1)));
        String ruta = "/api/monitoreo/peticiones?actorId=" + u.id() + "&desde=" + desde + "&hasta=" + hasta;
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            Respuesta r = get(ruta, admin());
            esperarStatus(r, 200);
            assertThat(r.datos().path("total").asLong()).isGreaterThanOrEqualTo(2);
        });

        JsonNode filas = get(ruta + "&estado=403", admin()).datos().path("contenido");
        assertThat(filas).isNotEmpty();
        JsonNode f = filas.get(0);
        assertThat(f.path("metodo").asString()).isEqualTo("GET");
        assertThat(f.path("ruta").asString()).isEqualTo("/api/roles");
        assertThat(f.path("estado").asInt()).isEqualTo(403);
        assertThat(f.path("actorUsuario").asString()).isEqualTo(u.usuario());
        assertThat(Instant.parse(f.path("ocurridoEn").asString())).isAfter(Instant.now().minus(Duration.ofMinutes(5)));
    }

    @Test
    void fechasInvalidasSon400NoErrores500() {
        esperarStatus(get("/api/monitoreo/peticiones?desde=ayer", admin()), 400);
        esperarStatus(get("/api/monitoreo/peticiones?desde=2026-02-30", admin()), 400);
        esperarStatus(get("/api/monitoreo/peticiones?hasta=%2B999999999-12-31T23:59:59Z", admin()), 400);
        esperarStatus(get("/api/monitoreo/peticiones?desde=2026-11-10T15:00:00Z&hasta=2026-11-10T14:00:00Z", admin()), 400);
        esperarStatus(get("/api/auditoria?desde=1900-01-01", admin()), 400);
        esperarStatus(get("/api/monitoreo/usuarios/1/actividad?zona=Marte/Base", admin()), 400);
    }

    @Test
    void actividadAgrupaPorDiaEnLaZonaPedida() {
        UsuarioPrueba u = crearUsuario("VER_USUARIOS");
        // Ayer a las 03:30 UTC = anteayer 22:30 en Lima (UTC-5). Instante fijo: no depende
        // de la zona de la sesion JDBC ni de la del equipo que corre la prueba.
        java.time.OffsetDateTime cuando = java.time.LocalDate.now(java.time.ZoneOffset.UTC).minusDays(1)
                .atTime(3, 30).atOffset(java.time.ZoneOffset.UTC);
        jdbc.update("""
                INSERT INTO peticiones (ocurrido_en, actor_id, actor_usuario, metodo, ruta, uri, estado, duracion_ms)
                VALUES (?, ?, ?, 'GET', '/api/usuarios', '/api/usuarios', 200, 5)""", cuando, u.id(), u.usuario());
        JsonNode utc = get("/api/monitoreo/usuarios/" + u.id() + "/actividad?dias=7", admin()).datos();
        JsonNode lima = get("/api/monitoreo/usuarios/" + u.id() + "/actividad?dias=7&zona=America/Lima", admin()).datos();
        assertThat(utc.path("zona").asString()).isEqualTo("Z");
        assertThat(lima.path("zona").asString()).isEqualTo("America/Lima");
        String diaUtc = utc.path("porDia").get(0).path("etiqueta").asString();
        String diaLima = lima.path("porDia").get(0).path("etiqueta").asString();
        assertThat(diaUtc).isEqualTo(cuando.toLocalDate().toString());
        assertThat(diaLima).isEqualTo(cuando.toLocalDate().minusDays(1).toString()); // el dia anterior en Lima
    }

    @Test
    void resumenYSerieResponden() {
        Respuesta r = get("/api/monitoreo/resumen?minutos=15", admin());
        esperarStatus(r, 200);
        assertThat(r.datos().path("sistema").path("estado").asString()).isIn("OPERATIVO", "DEGRADADO");
        assertThat(r.datos().path("sistema").path("baseDatos").path("disponible").asBoolean()).isTrue();
        assertThat(get("/api/monitoreo/serie?minutos=60", admin()).datos()).hasSize(60);
        esperarStatus(get("/api/monitoreo/serie?minutos=0", admin()), 400);
    }
}
