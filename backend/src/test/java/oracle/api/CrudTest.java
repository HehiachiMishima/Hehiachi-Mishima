package oracle.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import oracle.soporte.ApiPrueba;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/** Camino feliz de usuarios, roles, permisos, asignaciones, overrides y resolucion deny-wins. */
class CrudTest extends ApiPrueba {

    @Test
    void usuariosCrudCompleto() {
        String nombre = unico("crud");
        Respuesta c = post("/api/usuarios", m("usuario", nombre, "contrasena", CONTRASENA_VALIDA, "nombre", "Ana",
                "apellido", "Pérez", "email", nombre + "@crud.test", "telefono", "123"), admin());
        esperarStatus(c, 200);
        long id = c.datos().path("id").asLong();
        assertThat(c.datos().path("usuario").asString()).isEqualTo(nombre);
        assertThat(c.datos().path("activo").asBoolean()).isTrue();
        assertThat(c.datos().path("protegido").asBoolean()).isFalse();
        assertThat(c.datos().has("contrasena")).isFalse();
        assertThat(jdbc.queryForObject("SELECT contrasena FROM usuarios WHERE id = ?", String.class, id))
                .startsWith("$2").isNotEqualTo(CONTRASENA_VALIDA);

        assertThat(get("/api/usuarios/" + id, admin()).datos().path("email").asString()).isEqualTo(nombre + "@crud.test");
        assertThat(nombres(get("/api/usuarios", admin()).datos(), "usuario")).contains(nombre);
        Respuesta b = get("/api/usuarios/buscar?usuario=" + q(nombre) + "&activo=true", admin());
        esperarStatus(b, 200);
        assertThat(nombres(b.datos(), "usuario")).containsExactly(nombre);

        Respuesta u = put("/api/usuarios/" + id, m("nombre", "Ana María", "telefono", "999"), admin());
        esperarStatus(u, 200);
        assertThat(u.datos().path("nombre").asString()).isEqualTo("Ana María");
        assertThat(u.datos().path("apellido").asString()).isEqualTo("Pérez"); // parcial

        Respuesta e = patch("/api/usuarios/" + id + "/activo", m("activo", false, "motivo", "vacaciones"), admin());
        esperarStatus(e, 200);
        assertThat(e.datos().path("activo").asBoolean()).isFalse();
        assertThat(nombres(get("/api/usuarios/buscar?activo=false&usuario=" + q(nombre), admin()).datos(), "usuario"))
                .containsExactly(nombre);

        esperarStatus(delete("/api/usuarios/" + id, admin()), 200);
        esperarStatus(get("/api/usuarios/" + id, admin()), 404);
        esperarStatus(delete("/api/usuarios/" + id, admin()), 404);
    }

    @Test
    void usuarioOEmailDuplicadoDa409() {
        String nombre = unico("dup");
        crearUsuarioApi(nombre, CONTRASENA_VALIDA);
        esperarStatus(post("/api/usuarios", m("usuario", nombre, "contrasena", CONTRASENA_VALIDA, "nombre", "A",
                "apellido", "B", "email", unico("otro") + "@x.test"), admin()), 409);
        esperarStatus(post("/api/usuarios", m("usuario", unico("otro"), "contrasena", CONTRASENA_VALIDA, "nombre", "A",
                "apellido", "B", "email", nombre + "@pruebas.test"), admin()), 409);
    }

    @Test
    void rolesCrudCompleto() {
        String nombre = unico("ROLC").toUpperCase();
        Respuesta c = post("/api/roles", m("nombre", "  " + nombre + "  ", "descripcion", "d"), admin());
        esperarStatus(c, 200);
        long id = c.datos().path("id").asLong();
        assertThat(c.datos().path("nombre").asString()).isEqualTo(nombre); // trim
        assertThat(c.datos().path("protegido").asBoolean()).isFalse();
        esperarStatus(post("/api/roles", m("nombre", nombre), admin()), 409);
        assertThat(get("/api/roles/" + id, admin()).datos().path("nombre").asString()).isEqualTo(nombre);
        assertThat(nombres(get("/api/roles/buscar?nombre=" + q(nombre), admin()).datos(), "nombre")).containsExactly(nombre);
        Respuesta u = put("/api/roles/" + id, m("descripcion", "nueva"), admin());
        esperarStatus(u, 200);
        assertThat(u.datos().path("descripcion").asString()).isEqualTo("nueva");
        esperarStatus(patch("/api/roles/" + id + "/activo", m("activo", false), admin()), 200);
        assertThat(get("/api/roles/" + id, admin()).datos().path("activo").asBoolean()).isFalse();
        esperarStatus(delete("/api/roles/" + id, admin()), 200);
        esperarStatus(get("/api/roles/" + id, admin()), 404);
    }

    @Test
    void permisosCrudCompleto() {
        String nombre = unico("PERC").toUpperCase();
        Respuesta c = post("/api/permisos", m("nombre", nombre, "descripcion", "d"), admin());
        esperarStatus(c, 200);
        long id = c.datos().path("id").asLong();
        esperarStatus(post("/api/permisos", m("nombre", nombre), admin()), 409);
        assertThat(nombres(get("/api/permisos/buscar?nombre=" + q(nombre), admin()).datos(), "nombre"))
                .containsExactly(nombre);
        esperarStatus(put("/api/permisos/" + id, m("descripcion", "nueva"), admin()), 200);
        esperarStatus(patch("/api/permisos/" + id + "/activo", m("activo", false), admin()), 200);
        assertThat(get("/api/permisos/" + id, admin()).datos().path("activo").asBoolean()).isFalse();
        esperarStatus(delete("/api/permisos/" + id, admin()), 200);
        esperarStatus(get("/api/permisos/" + id, admin()), 404);
    }

    @Test
    void asignacionesRolUsuarioYPermisoRol() {
        long rol = crearRol(unico("ASIG").toUpperCase());
        long permiso = post("/api/permisos", m("nombre", unico("PASIG").toUpperCase()), admin()).datos().path("id").asLong();
        long usuario = crearUsuarioApi(unico("asig"), CONTRASENA_VALIDA);

        Respuesta rp = post("/api/roles/" + rol + "/permisos", m("permisoId", permiso), admin());
        esperarStatus(rp, 200);
        assertThat(rp.datos().path("rolId").asLong()).isEqualTo(rol);
        assertThat(rp.datos().path("permisoId").asLong()).isEqualTo(permiso);
        esperarStatus(post("/api/roles/" + rol + "/permisos", m("permisoId", permiso), admin()), 409);
        assertThat(nombres(get("/api/roles/" + rol + "/permisos", admin()).datos(), "id"))
                .containsExactly(String.valueOf(permiso));
        assertThat(nombres(get("/api/permisos/" + permiso + "/roles", admin()).datos(), "id"))
                .contains(String.valueOf(rol));

        Respuesta ur = post("/api/usuarios/" + usuario + "/roles", m("rolId", rol), admin());
        esperarStatus(ur, 200);
        assertThat(ur.datos().path("usuarioId").asLong()).isEqualTo(usuario);
        esperarStatus(post("/api/usuarios/" + usuario + "/roles", m("rolId", rol), admin()), 409);
        assertThat(nombres(get("/api/usuarios/" + usuario + "/roles", admin()).datos(), "id"))
                .containsExactly(String.valueOf(rol));
        assertThat(nombres(get("/api/roles/" + rol + "/usuarios", admin()).datos(), "id"))
                .containsExactly(String.valueOf(usuario));

        Respuesta resumen = get("/api/usuarios/resumen?ids=" + usuario, admin());
        esperarStatus(resumen, 200);
        assertThat(resumen.datos()).hasSize(1);
        String rolNombre = get("/api/roles/" + rol, admin()).datos().path("nombre").asString();
        assertThat(textos(resumen.datos().get(0).path("roles"))).containsExactly(rolNombre);

        esperarStatus(delete("/api/usuarios/" + usuario + "/roles/" + rol, admin()), 200);
        assertThat(get("/api/usuarios/" + usuario + "/roles", admin()).datos()).isEmpty();
        esperarStatus(delete("/api/roles/" + rol + "/permisos/" + permiso, admin()), 200);
        assertThat(get("/api/roles/" + rol + "/permisos", admin()).datos()).isEmpty();
        esperarStatus(post("/api/usuarios/" + usuario + "/roles", m("rolId", 987654321L), admin()), 404);
        esperarStatus(post("/api/roles/" + rol + "/permisos", m("permisoId", 987654321L), admin()), 404);
    }

    @Test
    void resolucionDenyWinsConEfectoInmediato() {
        UsuarioPrueba u = crearUsuario("VER_ROLES", "VER_PERMISOS");
        long verRoles = idPermiso("VER_ROLES");
        String rolNombre = get("/api/roles/" + u.rolId(), admin()).datos().path("nombre").asString();
        esperarStatus(get("/api/roles", u.token()), 200);

        // Deny individual sobre un permiso que llega por rol: gana el deny, al instante.
        esperarStatus(put("/api/usuarios/" + u.id() + "/permisos", m("permisoId", verRoles, "otorgado", false), admin()),
                200);
        esperarStatus(get("/api/roles", u.token()), 403);

        Respuesta ef = get("/api/resolucion/usuarios/" + u.id() + "/efectivos", admin());
        esperarStatus(ef, 200);
        List<JsonNode> filasVerRoles = new java.util.ArrayList<>();
        ef.datos().forEach(n -> {
            if (n.path("permisoId").asLong() == verRoles) {
                filasVerRoles.add(n);
            }
        });
        assertThat(filasVerRoles).hasSize(2);
        JsonNode porRol = filasVerRoles.stream().filter(n -> n.path("origen").asString().equals("ROL")).findFirst()
                .orElseThrow();
        JsonNode porOverride = filasVerRoles.stream().filter(n -> n.path("origen").asString().equals("OVERRIDE"))
                .findFirst().orElseThrow();
        assertThat(porRol.path("otorgado").asBoolean()).isTrue();
        assertThat(textos(porRol.path("roles"))).containsExactly(rolNombre);
        assertThat(porOverride.path("otorgado").asBoolean()).isFalse();
        assertThat(porOverride.path("roles")).isEmpty();

        JsonNode finalVerRoles = null;
        for (JsonNode n : get("/api/resolucion/usuarios/" + u.id() + "/finales", admin()).datos()) {
            if (n.path("permisoId").asLong() == verRoles) {
                finalVerRoles = n;
            }
        }
        assertThat(finalVerRoles).isNotNull();
        assertThat(finalVerRoles.path("permitido").asBoolean()).isFalse();
        assertThat(nombres(get("/api/resolucion/usuarios/" + u.id() + "/permitidos", admin()).datos(), "permisoId"))
                .doesNotContain(String.valueOf(verRoles)).contains(String.valueOf(idPermiso("VER_PERMISOS")));
        assertThat(get("/api/resolucion/usuarios/" + u.id() + "/" + verRoles + "/tiene", admin()).datos().asBoolean())
                .isFalse();
        assertThat(nombres(get("/api/usuarios/" + u.id() + "/permisos/denegados", admin()).datos(), "permisoId"))
                .containsExactly(String.valueOf(verRoles));
        assertThat(nombres(get("/api/usuarios/" + u.id() + "/permisos/con-override", admin()).datos(), "id"))
                .containsExactly(String.valueOf(verRoles));

        // Grant individual de un permiso que no llega por rol.
        long verUsuarios = idPermiso("VER_USUARIOS");
        esperarStatus(put("/api/usuarios/" + u.id() + "/permisos", m("permisoId", verUsuarios, "otorgado", true),
                admin()), 200);
        esperarStatus(get("/api/usuarios/" + u.id(), u.token()), 200);
        assertThat(get("/api/usuarios/" + u.id() + "/permisos", admin()).datos()).hasSize(2);

        // Quitar el deny devuelve el permiso del rol; quitar el grant lo retira.
        esperarStatus(delete("/api/usuarios/" + u.id() + "/permisos/" + verRoles, admin()), 200);
        esperarStatus(get("/api/roles", u.token()), 200);
        esperarStatus(delete("/api/usuarios/" + u.id() + "/permisos/" + verUsuarios, admin()), 200);
        esperarStatus(get("/api/usuarios/" + u.id(), u.token()), 403);
        assertThat(get("/api/resolucion/usuarios/" + u.id() + "/" + verRoles + "/tiene", admin()).datos().asBoolean())
                .isTrue();
    }

    @Test
    void desactivarUnRolOUnPermisoRetiraElAccesoAlInstante() {
        UsuarioPrueba u = crearUsuario("VER_ROLES");
        esperarStatus(get("/api/roles", u.token()), 200);
        esperarStatus(patch("/api/roles/" + u.rolId() + "/activo", m("activo", false), admin()), 200);
        esperarStatus(get("/api/roles", u.token()), 403);
        esperarStatus(patch("/api/roles/" + u.rolId() + "/activo", m("activo", true), admin()), 200);
        esperarStatus(get("/api/roles", u.token()), 200);
    }

    @Test
    void analiticaYResumenGlobal() {
        Respuesta a = get("/api/admin/analitica", admin());
        esperarStatus(a, 200);
        assertThat(a.datos().path("kpis").path("usuarios").asLong()).isPositive();
        assertThat(a.datos().has("coberturaPaneles")).isTrue();
        Respuesta r = get("/api/usuarios/resumen", admin());
        esperarStatus(r, 200);
        assertThat(r.datos().size()).isPositive();
    }
}
