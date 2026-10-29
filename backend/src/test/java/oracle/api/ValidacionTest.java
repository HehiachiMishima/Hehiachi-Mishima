package oracle.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.Collectors;
import java.util.stream.IntStream;
import oracle.soporte.ApiPrueba;
import org.junit.jupiter.api.Test;

/** 400 con detalle por campo, politica de contrasenas y errores HTTP genericos (nunca 500). */
class ValidacionTest extends ApiPrueba {

    @Test
    void crearUsuarioVacioDevuelve400ConTodosLosCampos() {
        Respuesta r = post("/api/usuarios", m(), admin());
        esperarStatus(r, 400);
        assertThat(r.json().path("status").asInt()).isEqualTo(400);
        assertThat(r.json().path("ruta").asString()).isEqualTo("/api/usuarios");
        assertThat(r.json().path("campos").propertyNames())
                .contains("usuario", "contrasena", "nombre", "apellido", "email");
    }

    @Test
    void emailYLargosInvalidos() {
        Respuesta r = post("/api/usuarios", m("usuario", "x".repeat(51), "contrasena", CONTRASENA_VALIDA, "nombre", "A",
                "apellido", "B", "email", "no-es-email", "telefono", "1".repeat(21)), admin());
        esperarStatus(r, 400);
        assertThat(r.json().path("campos").propertyNames()).contains("usuario", "email", "telefono");
    }

    @Test
    void politicaDeContrasenas() {
        for (String mala : new String[] {"corta1", "sololetrasmuylarga", "123456789012345", "Password1234",
                "ñ".repeat(40) + "a1", "a1".repeat(37)}) {
            Respuesta r = post("/api/usuarios", m("usuario", unico("pw"), "contrasena", mala, "nombre", "A",
                    "apellido", "B", "email", unico("pw") + "@x.test"), admin());
            esperarStatus(r, 400);
            assertThat(r.json().path("campos").has("contrasena")).as("contrasena '%s'", mala).isTrue();
        }
        long u = crearUsuarioApi(unico("pw"), CONTRASENA_VALIDA);
        Respuesta r = put("/api/usuarios/" + u, m("contrasena", "ñ".repeat(40) + "a1"), admin());
        esperarStatus(r, 400);
        assertThat(r.json().path("campos").has("contrasena")).isTrue();
        // Justo 72 bytes es valida.
        esperarStatus(put("/api/usuarios/" + u, m("contrasena", "a1".repeat(36)), admin()), 200);
        esperarStatus(intentarLogin(jdbc.queryForObject("SELECT usuario FROM usuarios WHERE id = ?", String.class, u),
                "a1".repeat(36), ipNueva()), 200);
    }

    @Test
    void otrosCuerposInvalidos() {
        Respuesta r = post("/api/roles", m("nombre", "  "), admin());
        esperarStatus(r, 400);
        assertThat(r.json().path("campos").has("nombre")).isTrue();
        esperarStatus(post("/api/permisos", m("nombre", "P".repeat(51)), admin()), 400);
        long u = crearUsuarioApi(unico("v"), CONTRASENA_VALIDA);
        Respuesta estado = patch("/api/usuarios/" + u + "/activo", m("motivo", "x".repeat(201)), admin());
        esperarStatus(estado, 400);
        assertThat(estado.json().path("campos").propertyNames()).contains("activo", "motivo");
        esperarStatus(put("/api/usuarios/" + u + "/permisos", m("permisoId", 1), admin()), 400);
        esperarStatus(post("/api/usuarios/" + u + "/roles", m(), admin()), 400);
        esperarStatus(patch("/api/usuarios/" + u + "/activo", "{\"activo\":\"quizas\"}", admin()), 400);
    }

    @Test
    void erroresHttpGenericosSinStacktrace() {
        Respuesta malJson = post("/api/roles", "{\"nombre\":", admin());
        esperarStatus(malJson, 400);
        assertThat(malJson.cuerpo()).doesNotContain("Exception").doesNotContain("at oracle.");
        esperarStatus(get("/api/usuarios/abc", admin()), 400);
        esperarStatus(get("/api/no-existe", admin()), 404);
        esperarStatus(llamar("PATCH", "/api/roles", m("nombre", "x"), admin()), 405);
        esperarStatus(llamar("POST", "/api/roles", null, admin(), "Content-Type", "text/plain"), 415);
        esperarStatus(get("/api/usuarios/resumen?ids=abc", admin()), 400);
        String muchos = IntStream.rangeClosed(1, 501).mapToObj(Integer::toString).collect(Collectors.joining(","));
        esperarStatus(get("/api/usuarios/resumen?ids=" + muchos, admin()), 400);
    }
}
