package oracle.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import oracle.soporte.ApiPrueba;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/** Bitacora de auditoria: eventos, filtros, relacionadoCon, paginacion, catalogo, CSV y append-only. */
class AuditoriaTest extends ApiPrueba {

    private static final List<String> CATALOGO_BRIEF = List.of("LOGIN_EXITOSO", "LOGIN_FALLIDO", "LOGIN_BLOQUEADO",
            "CONTRASENA_CAMBIADA", "USUARIO_CREADO", "USUARIO_ACTUALIZADO", "USUARIO_ELIMINADO",
            "USUARIO_ESTADO_CAMBIADO", "ROL_CREADO", "ROL_ACTUALIZADO", "ROL_ELIMINADO", "ROL_ESTADO_CAMBIADO",
            "PERMISO_CREADO", "PERMISO_ACTUALIZADO", "PERMISO_ELIMINADO", "PERMISO_ESTADO_CAMBIADO", "ROL_ASIGNADO",
            "ROL_REVOCADO", "PERMISO_ASIGNADO_ROL", "PERMISO_REVOCADO_ROL", "OVERRIDE_ESTABLECIDO",
            "OVERRIDE_ELIMINADO", "ACCESO_DENEGADO");

    private static String rid() {
        return "t-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
    }

    private static List<String> acciones(List<JsonNode> l) {
        List<String> a = new ArrayList<>();
        l.forEach(e -> a.add(e.path("accion").asString()));
        return a;
    }

    // ------------------------------------------------------------------

    @Test
    void cadaMutacionRegistraSuEventoConActorIpYCorrelacion() {
        String r1 = rid();
        String[] h = {"X-Request-Id", r1, "User-Agent", "agente-pruebas/1.0"};
        String nombre = unico("aud");
        long u = post("/api/usuarios", m("usuario", nombre, "contrasena", CONTRASENA_VALIDA, "nombre", "A",
                "apellido", "B", "email", nombre + "@aud.test"), admin(), h).datos().path("id").asLong();
        long r = post("/api/roles", m("nombre", unico("RAUD").toUpperCase()), admin(), h).datos().path("id").asLong();
        long p = post("/api/permisos", m("nombre", unico("PAUD").toUpperCase()), admin(), h).datos().path("id").asLong();
        esperarStatus(put("/api/usuarios/" + u, m("nombre", "Nuevo"), admin(), h), 200);
        esperarStatus(patch("/api/usuarios/" + u + "/activo", m("activo", false, "motivo", "baja temporal"), admin(), h), 200);
        esperarStatus(put("/api/roles/" + r, m("descripcion", "x"), admin(), h), 200);
        esperarStatus(patch("/api/roles/" + r + "/activo", m("activo", true), admin(), h), 200);
        esperarStatus(put("/api/permisos/" + p, m("descripcion", "x"), admin(), h), 200);
        esperarStatus(patch("/api/permisos/" + p + "/activo", m("activo", true), admin(), h), 200);
        esperarStatus(post("/api/roles/" + r + "/permisos", m("permisoId", p), admin(), h), 200);
        esperarStatus(post("/api/usuarios/" + u + "/roles", m("rolId", r), admin(), h), 200);
        esperarStatus(put("/api/usuarios/" + u + "/permisos", m("permisoId", p, "otorgado", false), admin(), h), 200);
        esperarStatus(delete("/api/usuarios/" + u + "/permisos/" + p, admin(), h), 200);
        esperarStatus(delete("/api/usuarios/" + u + "/roles/" + r, admin(), h), 200);
        esperarStatus(delete("/api/roles/" + r + "/permisos/" + p, admin(), h), 200);
        esperarStatus(delete("/api/usuarios/" + u, admin(), h), 200);
        esperarStatus(delete("/api/roles/" + r, admin(), h), 200);
        esperarStatus(delete("/api/permisos/" + p, admin(), h), 200);

        List<JsonNode> deUsuario = esperarEventos("relacionadoCon=USUARIO:" + u, contieneAcciones(
                "USUARIO_CREADO", "USUARIO_ACTUALIZADO", "USUARIO_ESTADO_CAMBIADO", "ROL_ASIGNADO", "ROL_REVOCADO",
                "OVERRIDE_ESTABLECIDO", "OVERRIDE_ELIMINADO", "USUARIO_ELIMINADO"));
        List<JsonNode> deRol = esperarEventos("relacionadoCon=ROL:" + r, contieneAcciones(
                "ROL_CREADO", "ROL_ACTUALIZADO", "ROL_ESTADO_CAMBIADO", "PERMISO_ASIGNADO_ROL", "ROL_ASIGNADO",
                "ROL_REVOCADO", "PERMISO_REVOCADO_ROL", "ROL_ELIMINADO"));
        List<JsonNode> dePermiso = esperarEventos("relacionadoCon=PERMISO:" + p, contieneAcciones(
                "PERMISO_CREADO", "PERMISO_ACTUALIZADO", "PERMISO_ESTADO_CAMBIADO", "PERMISO_ASIGNADO_ROL",
                "OVERRIDE_ESTABLECIDO", "OVERRIDE_ELIMINADO", "PERMISO_REVOCADO_ROL", "PERMISO_ELIMINADO"));
        // relacionadoCon no mezcla registros ajenos.
        assertThat(acciones(deUsuario)).doesNotContain("ROL_CREADO", "PERMISO_CREADO", "PERMISO_ASIGNADO_ROL");
        assertThat(acciones(dePermiso)).doesNotContain("ROL_ASIGNADO", "USUARIO_CREADO");

        long admin = idAdmin();
        for (JsonNode e : deUsuario) {
            assertThat(e.path("actorId").asLong()).isEqualTo(admin);
            assertThat(e.path("actorUsuario").asString()).isEqualTo(ADMIN);
            assertThat(e.path("resultado").asString()).isEqualTo("EXITO");
            assertThat(e.path("idCorrelacion").asString()).isEqualTo(r1);
            assertThat(e.path("ip").asString()).isNotBlank();
            assertThat(e.path("userAgent").asString()).isEqualTo("agente-pruebas/1.0");
            assertThat(e.path("ocurridoEn").asString()).endsWith("Z");
        }
        JsonNode asignado = unoConAccion(deRol, "ROL_ASIGNADO");
        assertThat(asignado.path("entidad").asString()).isEqualTo("USUARIO_ROL");
        assertThat(asignado.path("entidadId").asString()).isEqualTo(u + ":" + r);
        assertThat(unoConAccion(dePermiso, "PERMISO_ASIGNADO_ROL").path("entidadId").asString()).isEqualTo(r + ":" + p);
        assertThat(unoConAccion(dePermiso, "OVERRIDE_ESTABLECIDO").path("entidadId").asString()).isEqualTo(u + ":" + p);
        assertThat(unoConAccion(deUsuario, "USUARIO_ESTADO_CAMBIADO").path("detalle").path("motivo").asString())
                .isEqualTo("baja temporal");
        JsonNode actualizado = unoConAccion(deUsuario, "USUARIO_ACTUALIZADO").path("detalle");
        assertThat(actualizado.has("antes")).isTrue();
        assertThat(actualizado.has("despues")).isTrue();
    }

    @Test
    void laContrasenaNuncaLlegaALaBitacora() {
        UsuarioPrueba u = crearUsuario();
        String nueva = "SecretoReset2026x";
        esperarStatus(put("/api/usuarios/" + u.id(), m("contrasena", nueva), admin()), 200);
        List<JsonNode> ev = esperarEventos("relacionadoCon=USUARIO:" + u.id(),
                contieneAcciones("USUARIO_ACTUALIZADO", "CONTRASENA_CAMBIADA", "USUARIO_CREADO"));
        String todo = ev.toString();
        assertThat(todo).doesNotContain(nueva).doesNotContain(CONTRASENA_VALIDA).doesNotContain("$2a$")
                .doesNotContain("$2b$");
        assertThat(unoConAccion(ev, "USUARIO_ACTUALIZADO").path("detalle").toString()).contains("(cambiada)");
    }

    @Test
    void loginExitosoYFallidoSinFiltrarLaCredencial() {
        UsuarioPrueba u = crearUsuario();
        esperarEventos("relacionadoCon=USUARIO:" + u.id() + "&accion=LOGIN_EXITOSO", l -> !l.isEmpty()
                && l.get(0).path("actorId").asLong() == u.id() && l.get(0).path("entidad").asString().equals("SESION"));

        String r1 = rid();
        String credencial = "MiClaveSecreta" + UUID.randomUUID().toString().substring(0, 6);
        esperarStatus(post("/api/auth/login", m("usuario", credencial, "contrasena", "x"), null,
                "X-Forwarded-For", ipNueva(), "X-Request-Id", r1), 401);
        List<JsonNode> ev = esperarEventos("q=" + r1, l -> !l.isEmpty());
        JsonNode e = unoConAccion(ev, "LOGIN_FALLIDO");
        assertThat(e.path("resultado").asString()).isEqualTo("FALLO");
        assertThat(e.path("actorId").isNull()).isTrue();
        assertThat(e.path("actorUsuario").isNull()).isTrue();
        assertThat(e.path("detalle").path("motivo").asString()).isEqualTo("credencial_desconocida");
        assertThat(e.path("detalle").path("huella").asString()).matches("[0-9a-f]{12}");
        assertThat(e.toString()).doesNotContain(credencial).doesNotContain(credencial.toLowerCase());
    }

    @Test
    void accesoDenegadoSeRegistra() {
        UsuarioPrueba u = crearUsuario();
        esperarStatus(get("/api/auditoria", u.token()), 403);
        List<JsonNode> ev = esperarEventos("actorId=" + u.id() + "&accion=ACCESO_DENEGADO", l -> !l.isEmpty());
        JsonNode e = ev.get(0);
        assertThat(e.path("resultado").asString()).isEqualTo("DENEGADO");
        assertThat(e.path("actorUsuario").asString()).isEqualTo(u.usuario());
        assertThat(e.path("detalle").path("metodo").asString()).isEqualTo("GET");
        assertThat(e.path("detalle").path("ruta").asString()).isEqualTo("/api/auditoria");
    }

    @Test
    void filtrosCombinados() {
        UsuarioPrueba u = crearUsuario("VER_ROLES");
        long rol = u.rolId();
        esperarStatus(put("/api/roles/" + rol, m("descripcion", "f1"), admin()), 200);
        esperarStatus(get("/api/auditoria", u.token()), 403);
        String base = "relacionadoCon=ROL:" + rol;
        esperarEventos(base, contieneAcciones("ROL_CREADO", "PERMISO_ASIGNADO_ROL", "ROL_ASIGNADO", "ROL_ACTUALIZADO"));

        assertThat(acciones(eventos(base + "&accion=ROL_CREADO,ROL_ACTUALIZADO")))
                .containsExactlyInAnyOrder("ROL_CREADO", "ROL_ACTUALIZADO");
        assertThat(acciones(eventos("entidad=ROL&entidadId=" + rol)))
                .containsExactlyInAnyOrder("ROL_CREADO", "ROL_ACTUALIZADO");
        assertThat(eventos(base + "&resultado=DENEGADO")).isEmpty();
        assertThat(acciones(eventos("actorId=" + u.id() + "&resultado=DENEGADO"))).containsOnly("ACCESO_DENEGADO");
        assertThat(acciones(eventos("q=" + q(u.usuario()) + "&accion=LOGIN_EXITOSO"))).containsOnly("LOGIN_EXITOSO");
        assertThat(eventos("q=" + q(u.usuario().substring(0, u.usuario().length() - 1)) + "&actorId=" + u.id()))
                .isNotEmpty(); // prefijo
        assertThat(eventos(base + "&desde=" + Instant.now().plusSeconds(3600))).isEmpty();
        assertThat(eventos(base + "&desde=2026-01-01&hasta=" + Instant.now().plusSeconds(60))).isNotEmpty();
        assertThat(eventos(base + "&hasta=2020-01-01")).isEmpty();

        for (String malo : List.of("accion=NOPE", "entidad=NOPE", "resultado=QUIZA", "desde=xx",
                "desde=2026-02-01&hasta=2026-01-01", "actorId=abc", "relacionadoCon=FOO:1",
                "relacionadoCon=USUARIO:abc", "relacionadoCon=USUARIO", "q=" + "x".repeat(300))) {
            Respuesta r = get("/api/auditoria?" + malo, admin());
            assertThat(r.status()).as("filtro %s -> %s", malo, r).isEqualTo(400);
        }
    }

    @Test
    void paginacionOrdenadaYLimites() {
        long rol = crearRol(unico("PAG").toUpperCase());
        for (int i = 0; i < 6; i++) {
            esperarStatus(put("/api/roles/" + rol, m("descripcion", "v" + i), admin()), 200);
        }
        String base = "/api/auditoria?relacionadoCon=ROL:" + rol + "&tamano=3";
        esperarEventos("relacionadoCon=ROL:" + rol, l -> l.size() == 7);
        Set<Long> ids = new HashSet<>();
        String anterior = null;
        long idAnterior = Long.MAX_VALUE;
        for (int pagina = 1; pagina <= 3; pagina++) {
            Respuesta r = get(base + "&pagina=" + pagina, admin());
            esperarStatus(r, 200);
            JsonNode d = r.datos();
            assertThat(d.path("total").asLong()).isEqualTo(7);
            assertThat(d.path("totalPaginas").asInt()).isEqualTo(3);
            assertThat(d.path("pagina").asInt()).isEqualTo(pagina);
            assertThat(d.path("tamano").asInt()).isEqualTo(3);
            assertThat(d.path("contenido").size()).isEqualTo(pagina < 3 ? 3 : 1);
            for (JsonNode e : d.path("contenido")) {
                assertThat(ids.add(e.path("id").asLong())).isTrue();
                String t = e.path("ocurridoEn").asString();
                if (anterior != null) {
                    assertThat(Instant.parse(t)).isBeforeOrEqualTo(Instant.parse(anterior));
                    if (t.equals(anterior)) {
                        assertThat(e.path("id").asLong()).isLessThan(idAnterior);
                    }
                }
                anterior = t;
                idAnterior = e.path("id").asLong();
            }
        }
        assertThat(get(base + "&pagina=4", admin()).datos().path("contenido")).isEmpty();
        esperarStatus(get("/api/auditoria?tamano=0", admin()), 400);
        esperarStatus(get("/api/auditoria?tamano=101", admin()), 400);
        esperarStatus(get("/api/auditoria?pagina=0", admin()), 400);
        esperarStatus(get("/api/auditoria?pagina=5000&tamano=100", admin()), 400);
        assertThat(get("/api/auditoria", admin()).datos().path("tamano").asInt()).isEqualTo(25);
    }

    @Test
    void catalogoYDetallePorId() {
        Respuesta c = get("/api/auditoria/catalogo", admin());
        esperarStatus(c, 200);
        assertThat(textos(c.datos().path("acciones"))).containsAll(CATALOGO_BRIEF).contains("AUDITORIA_EXPORTADA");
        assertThat(textos(c.datos().path("entidades"))).contains("USUARIO", "ROL", "PERMISO", "USUARIO_ROL",
                "ROL_PERMISO", "USUARIO_PERMISO", "SESION");
        assertThat(textos(c.datos().path("resultados"))).containsExactlyInAnyOrder("EXITO", "FALLO", "DENEGADO");

        long rol = crearRol(unico("DET").toUpperCase());
        JsonNode e = esperarEventos("relacionadoCon=ROL:" + rol, l -> !l.isEmpty()).get(0);
        Respuesta d = get("/api/auditoria/" + e.path("id").asLong(), admin());
        esperarStatus(d, 200);
        assertThat(d.datos()).isEqualTo(e);
        esperarStatus(get("/api/auditoria/987654321", admin()), 404);
        esperarStatus(get("/api/auditoria/abc", admin()), 400);
    }

    @Test
    void exportarCsvConCabeceraBomYAntiInyeccionDeFormulas() {
        String r1 = rid();
        String uaMalicioso = "=cmd|' /C calc'!A0";
        esperarStatus(post("/api/auth/login", m("usuario", unico("csv"), "contrasena", "x"), null,
                "X-Forwarded-For", ipNueva(), "X-Request-Id", r1, "User-Agent", uaMalicioso), 401);
        esperarStatus(post("/api/roles", m("nombre", unico("CSV").toUpperCase(), "descripcion", "con \"comillas\""),
                admin(), "X-Request-Id", r1, "User-Agent", "+SUM(1,2)"), 200);
        esperarEventos("q=" + r1, l -> l.size() == 2);

        String r2 = rid();
        Respuesta csv = get("/api/auditoria/exportar?q=" + r1, admin(), "X-Request-Id", r2);
        esperarStatus(csv, 200);
        assertThat(csv.header("Content-Type")).startsWith("text/csv").containsIgnoringCase("charset=UTF-8");
        assertThat(csv.header("Content-Disposition"))
                .matches("attachment; filename=\"auditoria-\\d{8}-\\d{6}\\.csv\"");
        assertThat(csv.header("X-Request-Id")).isEqualTo(r2);
        String cuerpo = csv.cuerpo();
        assertThat(cuerpo).startsWith("﻿");
        String[] lineas = cuerpo.substring(1).split("\r\n");
        assertThat(lineas[0]).isEqualTo(
                "id,ocurridoEn,actorId,actorUsuario,accion,entidad,entidadId,resultado,ip,userAgent,idCorrelacion,detalle");
        assertThat(lineas).hasSize(3);
        String fallido = lineas[1].contains("LOGIN_FALLIDO") ? lineas[1] : lineas[2];
        String rol = lineas[1].contains("ROL_CREADO") ? lineas[1] : lineas[2];
        assertThat(fallido).contains("\"'=cmd|' /C calc'!A0\"").doesNotContain(",\"=cmd");
        assertThat(rol).contains("\"'@admin\"").contains("\"'+SUM(1,2)\"").contains("\\\"\"comillas\\\"\"");
        for (String l : lineas) {
            for (String celda : l.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)")) {
                if (celda.startsWith("\"")) {
                    assertThat(celda.charAt(1)).as("celda %s", celda).isNotIn('=', '+', '-', '@', '\t', '\r');
                } else {
                    assertThat(celda).as("celda sin comillas %s", celda).doesNotStartWith("=");
                }
            }
        }

        List<JsonNode> ev = esperarEventos("q=" + r2, l -> !l.isEmpty());
        JsonNode exp = unoConAccion(ev, "AUDITORIA_EXPORTADA");
        assertThat(exp.path("actorUsuario").asString()).isEqualTo(ADMIN);
        assertThat(exp.path("detalle").toString()).contains(r1).contains("2");
    }

    @Test
    void exportarConFiltroInvalidoDa400Json() {
        Respuesta r = get("/api/auditoria/exportar?accion=NOPE", admin());
        esperarStatus(r, 400);
        assertThat(r.header("Content-Type")).contains("application/json");
    }

    @Test
    void laBitacoraEsAppendOnlyEnLaBd() {
        long id = esperarEventos("accion=LOGIN_EXITOSO", l -> !l.isEmpty()).get(0).path("id").asLong();
        assertThatThrownBy(() -> jdbc.update("UPDATE auditoria_eventos SET accion = 'X' WHERE id = ?", id))
                .satisfies(e -> assertThat(sqlState(e)).isEqualTo("45000"));
        assertThatThrownBy(() -> jdbc.update("DELETE FROM auditoria_eventos WHERE id = ?", id))
                .satisfies(e -> assertThat(sqlState(e)).isEqualTo("45000"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM auditoria_eventos WHERE id = ?", Integer.class, id))
                .isEqualTo(1);
    }

    @Test
    void xRequestIdSeDevuelveSiempre() {
        assertThat(get("/api/health", null, "X-Request-Id", "abc-123_X").header("X-Request-Id")).isEqualTo("abc-123_X");
        for (String malo : List.of("a".repeat(65), "con.punto", "con espacio", "xñ")) {
            String devuelto = get("/api/health", null, "X-Request-Id", malo).header("X-Request-Id");
            assertThat(devuelto).isNotEqualTo(malo).matches("[0-9a-f-]{36}");
        }
        assertThat(get("/api/health", null).header("X-Request-Id")).matches("[0-9a-f-]{36}");
        assertThat(get("/api/usuarios", null).header("X-Request-Id")).isNotBlank(); // 401
        assertThat(get("/api/usuarios/987654321", admin()).header("X-Request-Id")).isNotBlank(); // 404
        assertThat(post("/api/usuarios", "{mal", admin()).header("X-Request-Id")).isNotBlank(); // 400

        // Un id demasiado largo no evade la bitacora (P1-5): el evento se escribe con el id del servidor.
        UsuarioPrueba u = crearUsuario();
        Respuesta r = get("/api/auditoria", u.token(), "X-Request-Id", "z".repeat(100));
        esperarStatus(r, 403);
        String servidor = r.header("X-Request-Id");
        List<JsonNode> ev = esperarEventos("q=" + servidor, l -> !l.isEmpty());
        assertThat(unoConAccion(ev, "ACCESO_DENEGADO").path("actorId").asLong()).isEqualTo(u.id());
    }

    private static String sqlState(Throwable t) {
        for (Throwable c = t; c != null; c = c.getCause()) {
            if (c instanceof SQLException s) {
                return s.getSQLState();
            }
        }
        return null;
    }
}
