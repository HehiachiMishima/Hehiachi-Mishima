package oracle.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.SQLException;
import java.util.List;
import oracle.soporte.ApiPrueba;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessException;
import tools.jackson.databind.JsonNode;

/**
 * Rol ADMINISTRADOR, permisos base, usuarios protegidos (@hehiachi por trigger,
 * usuario semilla y USUARIOS_PROTEGIDOS por configuracion) y el flag
 * "protegido" que usa la UI.
 */
class ProteccionesTest extends ApiPrueba {

    private static final List<String> BASE = List.of(
            "ASIGNAR_ROLES", "VER_ROLES", "CREAR_ROLES", "MODIFICAR_ROLES", "ELIMINAR_ROLES",
            "ASIGNAR_PERMISOS", "VER_PERMISOS", "CREAR_PERMISOS", "MODIFICAR_PERMISOS", "ELIMINAR_PERMISOS",
            "VER_USUARIOS", "CREAR_USUARIOS", "MODIFICAR_USUARIOS", "ELIMINAR_USUARIOS",
            "PANEL_ADMIN", "DASHBOARD_ADMIN", "VER_AUDITORIA", "VER_MONITOREO");

    private static String sqlState(Throwable t) {
        for (Throwable c = t; c != null; c = c.getCause()) {
            if (c instanceof SQLException s) {
                return s.getSQLState();
            }
        }
        return null;
    }

    // ---------------- ADMINISTRADOR ----------------

    @Test
    void rolAdministradorNoSeModificaDesactivaNiElimina() {
        long admin = idRolAdministrador();
        esperarStatus(put("/api/roles/" + admin, m("descripcion", "x"), admin()), 403);
        esperarStatus(put("/api/roles/" + admin, m("nombre", "ADMIN2"), admin()), 403);
        esperarStatus(patch("/api/roles/" + admin + "/activo", m("activo", false), admin()), 403);
        esperarStatus(delete("/api/roles/" + admin, admin()), 403);
        esperarStatus(delete("/api/roles/" + admin + "/permisos/" + idPermiso("VER_ROLES"), admin()), 403);
        assertThat(jdbc.queryForObject("SELECT activo FROM roles WHERE id = ?", Boolean.class, admin)).isTrue();
    }

    @Test
    void administradorTieneTodosLosPermisosBaseYLosNuevosSeLeAutoasignan() {
        Respuesta r = get("/api/roles/" + idRolAdministrador() + "/permisos", admin());
        esperarStatus(r, 200);
        assertThat(nombres(r.datos(), "nombre")).containsAll(BASE);
        Respuesta p = post("/api/permisos", m("nombre", unico("AUTO").toUpperCase()), admin());
        esperarStatus(p, 200);
        long id = p.datos().path("id").asLong();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM roles_permisos WHERE rol_id = ? AND permiso_id = ?",
                Integer.class, idRolAdministrador(), id)).isEqualTo(1);
    }

    @Test
    void crearOtroRolLlamadoAdministradorFalla() {
        Respuesta r = post("/api/roles", m("nombre", "administrador"), admin());
        assertThat(r.status()).as("respuesta: %s", r).isIn(403, 409);
    }

    // ---------------- Permisos base ----------------

    @Test
    void permisosBaseSonInmutables() {
        for (String p : List.of("VER_AUDITORIA", "ASIGNAR_ROLES", "DASHBOARD_ADMIN")) {
            long id = idPermiso(p);
            esperarStatus(put("/api/permisos/" + id, m("descripcion", "x"), admin()), 403);
            esperarStatus(put("/api/permisos/" + id, m("nombre", unico("RENOMBRE").toUpperCase()), admin()), 403);
            esperarStatus(patch("/api/permisos/" + id + "/activo", m("activo", false), admin()), 403);
            esperarStatus(delete("/api/permisos/" + id, admin()), 403);
        }
    }

    @Test
    void noSePuedeCrearNiRenombrarAUnNombreBase() {
        Respuesta r = post("/api/permisos", m("nombre", "ver_auditoria"), admin());
        assertThat(r.status()).as("respuesta: %s", r).isIn(403, 409);
        Respuesta nuevo = post("/api/permisos", m("nombre", unico("LIBRE").toUpperCase()), admin());
        esperarStatus(nuevo, 200);
        esperarStatus(put("/api/permisos/" + nuevo.datos().path("id").asLong(), m("nombre", "VER_USUARIOS"), admin()),
                403);
    }

    @Test
    void elTriggerDeLaBdTambienProtegeLosPermisosBase() {
        assertThatThrownBy(() -> jdbc.update("UPDATE permisos SET descripcion = 'x' WHERE nombre = 'VER_ROLES'"))
                .isInstanceOf(DataAccessException.class)
                .satisfies(e -> assertThat(sqlState(e)).isEqualTo("RB403"));
        assertThatThrownBy(() -> jdbc.update("DELETE FROM permisos WHERE nombre = 'VER_AUDITORIA'"))
                .satisfies(e -> assertThat(sqlState(e)).isEqualTo("RB403"));
    }

    // ---------------- Usuarios protegidos ----------------

    @Test
    void usuarioSemillaEstaProtegidoInclusoFrenteAOtroAdministrador() {
        UsuarioPrueba admin2 = crearAdministrador();
        long semilla = idAdmin();
        esperarStatus(put("/api/usuarios/" + semilla, m("nombre", "x"), admin2.token()), 403);
        esperarStatus(put("/api/usuarios/" + semilla, m("contrasena", "Tomada2026xxxx"), admin2.token()), 403);
        esperarStatus(patch("/api/usuarios/" + semilla + "/activo", m("activo", false), admin2.token()), 403);
        esperarStatus(delete("/api/usuarios/" + semilla, admin2.token()), 403);
        esperarStatus(delete("/api/usuarios/" + semilla + "/roles/" + idRolAdministrador(), admin2.token()), 403);
        esperarStatus(put("/api/usuarios/" + semilla + "/permisos",
                m("permisoId", idPermiso("VER_ROLES"), "otorgado", false), admin2.token()), 403);
        esperarStatus(get("/api/auth/sesion", admin()), 200);
    }

    @Test
    void usuarioProtegidoPorConfiguracionNoSeGestiona() {
        long id = asegurarUsuarioProtegidoExtra();
        esperarStatus(put("/api/usuarios/" + id, m("nombre", "x"), admin()), 403);
        esperarStatus(patch("/api/usuarios/" + id + "/activo", m("activo", false), admin()), 403);
        esperarStatus(delete("/api/usuarios/" + id, admin()), 403);
        long rol = crearRol(unico("RP").toUpperCase());
        esperarStatus(post("/api/usuarios/" + id + "/roles", m("rolId", rol), admin()), 403);
        Respuesta r = get("/api/usuarios/" + id, admin());
        esperarStatus(r, 200);
        assertThat(r.datos().path("protegido").asBoolean()).isTrue();
    }

    @Test
    void usuarioRaizProtegidoEnApiYEnBd() {
        long raiz = asegurarUsuarioRaiz();
        esperarStatus(put("/api/usuarios/" + raiz, m("nombre", "x"), admin()), 403);
        esperarStatus(patch("/api/usuarios/" + raiz + "/activo", m("activo", false), admin()), 403);
        esperarStatus(delete("/api/usuarios/" + raiz, admin()), 403);
        esperarStatus(delete("/api/usuarios/" + raiz + "/roles/" + idRolAdministrador(), admin()), 403);
        esperarStatus(put("/api/usuarios/" + raiz + "/permisos",
                m("permisoId", idPermiso("VER_ROLES"), "otorgado", false), admin()), 403);

        assertThatThrownBy(() -> jdbc.update("UPDATE usuarios SET nombre = 'x' WHERE id = ?", raiz))
                .satisfies(e -> assertThat(sqlState(e)).isEqualTo("RB403"));
        assertThatThrownBy(() -> jdbc.update("UPDATE usuarios SET credenciales_version = credenciales_version + 1 "
                + "WHERE id = ?", raiz)).satisfies(e -> assertThat(sqlState(e)).isEqualTo("RB403"));
        assertThatThrownBy(() -> jdbc.update("DELETE FROM usuarios WHERE id = ?", raiz))
                .satisfies(e -> assertThat(sqlState(e)).isEqualTo("RB403"));
        assertThatThrownBy(() -> jdbc.update("DELETE FROM usuarios_roles WHERE usuario_id = ?", raiz))
                .satisfies(e -> assertThat(sqlState(e)).isEqualTo("RB403"));
        // Contadores de bloqueo: permitidos por el trigger.
        jdbc.update("UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?", raiz);
    }

    @Test
    void unAdministradorNoSeGestionaASiMismoDesdeLaAdministracion() {
        UsuarioPrueba admin2 = crearAdministrador();
        esperarStatus(put("/api/usuarios/" + admin2.id(), m("nombre", "yo"), admin2.token()), 403);
        esperarStatus(delete("/api/usuarios/" + admin2.id(), admin2.token()), 403);
        esperarStatus(delete("/api/usuarios/" + admin2.id() + "/roles/" + idRolAdministrador(), admin2.token()), 403);
    }

    // ---------------- Flag protegido ----------------

    @Test
    void flagProtegidoEnRespuestas() {
        Respuesta roles = get("/api/roles", admin());
        esperarStatus(roles, 200);
        for (JsonNode r : roles.datos()) {
            assertThat(r.path("protegido").asBoolean()).as("rol %s", r.path("nombre"))
                    .isEqualTo("ADMINISTRADOR".equals(r.path("nombre").asString()));
        }
        Respuesta permisos = get("/api/permisos", admin());
        for (JsonNode p : permisos.datos()) {
            assertThat(p.path("protegido").asBoolean()).as("permiso %s", p.path("nombre"))
                    .isEqualTo(BASE.contains(p.path("nombre").asString()));
        }
        long raso = crearUsuarioApi(unico("raso"), CONTRASENA_VALIDA);
        assertThat(get("/api/usuarios/" + raso, admin()).datos().path("protegido").asBoolean()).isFalse();
        assertThat(get("/api/usuarios/" + idAdmin(), admin()).datos().path("protegido").asBoolean()).isTrue();
    }
}
