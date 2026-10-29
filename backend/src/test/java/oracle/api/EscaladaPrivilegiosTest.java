package oracle.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import oracle.soporte.ApiPrueba;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

/**
 * Regresiones de los escenarios P0/P1 de appsec.md: todos deben FALLAR (403)
 * y no dejar cambios en la BD. Tambien se comprueba el caso legitimo para no
 * dar por buena una regla que lo bloquea todo.
 */
class EscaladaPrivilegiosTest extends ApiPrueba {

    private int filas(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    // ---------------- P0-1 ----------------

    @Test
    void p01_noPuedeAgregarPermisosASuPropioRol() {
        UsuarioPrueba soporte = crearUsuario("ASIGNAR_PERMISOS", "VER_PERMISOS", "VER_ROLES");
        for (String p : List.of("ASIGNAR_ROLES", "MODIFICAR_USUARIOS", "VER_AUDITORIA", "VER_ROLES")) {
            Respuesta r = post("/api/roles/" + soporte.rolId() + "/permisos", m("permisoId", idPermiso(p)),
                    soporte.token());
            esperarStatus(r, 403);
        }
        assertThat(filas("SELECT COUNT(*) FROM roles_permisos WHERE rol_id = ?", soporte.rolId())).isEqualTo(3);
        // Tampoco quitar permisos de su propio rol.
        esperarStatus(delete("/api/roles/" + soporte.rolId() + "/permisos/" + idPermiso("VER_ROLES"),
                soporte.token()), 403);
        assertThat(filas("SELECT COUNT(*) FROM roles_permisos WHERE rol_id = ?", soporte.rolId())).isEqualTo(3);
        List<JsonNode> ev = esperarEventos("actorId=" + soporte.id() + "&accion=ACCESO_DENEGADO", l -> l.size() >= 5);
        assertThat(ev.get(0).path("resultado").asString()).isEqualTo("DENEGADO");
    }

    @Test
    void p01_noPuedeConcederAOtroRolUnPermisoQueNoTiene() {
        UsuarioPrueba soporte = crearUsuario("ASIGNAR_PERMISOS", "VER_PERMISOS", "VER_ROLES");
        long otro = crearRol(unico("OTRO").toUpperCase());
        esperarStatus(post("/api/roles/" + otro + "/permisos", m("permisoId", idPermiso("ELIMINAR_USUARIOS")),
                soporte.token()), 403);
        assertThat(filas("SELECT COUNT(*) FROM roles_permisos WHERE rol_id = ?", otro)).isZero();
        // Legitimo: conceder a otro rol un permiso que si tiene.
        esperarStatus(post("/api/roles/" + otro + "/permisos", m("permisoId", idPermiso("VER_ROLES")),
                soporte.token()), 200);
    }

    @Test
    void p01_noAdministradorNoAmpliaElRolAdministrador() {
        UsuarioPrueba soporte = crearUsuario("ASIGNAR_PERMISOS", "VER_PERMISOS", "VER_ROLES", "CREAR_PERMISOS");
        Respuesta nuevo = post("/api/permisos", m("nombre", unico("PX").toUpperCase()), soporte.token());
        esperarStatus(nuevo, 200);
        esperarStatus(post("/api/roles/" + idRolAdministrador() + "/permisos",
                m("permisoId", idPermiso("VER_ROLES")), soporte.token()), 403);
    }

    // ---------------- P0-2 ----------------

    @Test
    void p02_noPuedeDarAdministradorAUnaCuentaTitere() {
        UsuarioPrueba soporte = crearUsuario("ASIGNAR_ROLES", "CREAR_USUARIOS", "VER_USUARIOS", "VER_ROLES");
        Respuesta creado = post("/api/usuarios", m("usuario", unico("titere"), "contrasena", CONTRASENA_VALIDA,
                "nombre", "T", "apellido", "T", "email", unico("t") + "@x.test"), soporte.token());
        esperarStatus(creado, 200);
        long titere = creado.datos().path("id").asLong();
        esperarStatus(post("/api/usuarios/" + titere + "/roles", m("rolId", idRolAdministrador()), soporte.token()), 403);
        assertThat(filas("SELECT COUNT(*) FROM usuarios_roles WHERE usuario_id = ?", titere)).isZero();
    }

    @Test
    void p02_noPuedeAsignarUnRolConPermisosQueNoTiene() {
        UsuarioPrueba soporte = crearUsuario("ASIGNAR_ROLES", "VER_USUARIOS", "VER_ROLES");
        long rolPoderoso = crearRol(unico("PODER").toUpperCase(), "ELIMINAR_USUARIOS", "VER_ROLES");
        long victima = crearUsuarioApi(unico("v"), CONTRASENA_VALIDA);
        esperarStatus(post("/api/usuarios/" + victima + "/roles", m("rolId", rolPoderoso), soporte.token()), 403);
        // Legitimo: un rol cuyos permisos el actor si tiene.
        long rolMenor = crearRol(unico("MENOR").toUpperCase(), "VER_ROLES");
        esperarStatus(post("/api/usuarios/" + victima + "/roles", m("rolId", rolMenor), soporte.token()), 200);
    }

    @Test
    void p02_noPuedeAsignarseRolesASiMismo() {
        UsuarioPrueba soporte = crearUsuario("ASIGNAR_ROLES", "VER_USUARIOS", "VER_ROLES");
        long rolMenor = crearRol(unico("MENOR").toUpperCase(), "VER_ROLES");
        esperarStatus(post("/api/usuarios/" + soporte.id() + "/roles", m("rolId", rolMenor), soporte.token()), 403);
        esperarStatus(delete("/api/usuarios/" + soporte.id() + "/roles/" + soporte.rolId(), soporte.token()), 403);
    }

    @Test
    void p02_overrideGrantDePermisoQueNoTieneYAutoOverrideFallan() {
        UsuarioPrueba soporte = crearUsuario("ASIGNAR_PERMISOS", "VER_PERMISOS", "VER_USUARIOS");
        long titere = crearUsuarioApi(unico("t"), CONTRASENA_VALIDA);
        esperarStatus(put("/api/usuarios/" + titere + "/permisos",
                m("permisoId", idPermiso("ELIMINAR_ROLES"), "otorgado", true), soporte.token()), 403);
        esperarStatus(put("/api/usuarios/" + soporte.id() + "/permisos",
                m("permisoId", idPermiso("VER_USUARIOS"), "otorgado", true), soporte.token()), 403);
        assertThat(filas("SELECT COUNT(*) FROM usuarios_permisos WHERE usuario_id IN (?, ?)", titere, soporte.id()))
                .isZero();
        // Legitimo: un permiso que si tiene.
        esperarStatus(put("/api/usuarios/" + titere + "/permisos",
                m("permisoId", idPermiso("VER_PERMISOS"), "otorgado", true), soporte.token()), 200);
    }

    @Test
    void p02_noPuedeDenegarPermisosAUnAdministrador() {
        UsuarioPrueba soporte = crearUsuario("ASIGNAR_PERMISOS", "VER_PERMISOS", "VER_USUARIOS", "ASIGNAR_ROLES");
        UsuarioPrueba otroAdmin = crearAdministrador();
        esperarStatus(put("/api/usuarios/" + otroAdmin.id() + "/permisos",
                m("permisoId", idPermiso("ASIGNAR_ROLES"), "otorgado", false), soporte.token()), 403);
        esperarStatus(get("/api/usuarios", otroAdmin.token()), 200);
    }

    @Test
    void p02_noPuedeGestionarAUsuarioConPermisosQueElNoTiene() {
        UsuarioPrueba soporte = crearUsuario("ASIGNAR_PERMISOS", "VER_PERMISOS", "VER_USUARIOS");
        UsuarioPrueba superior = crearUsuario("VER_PERMISOS", "ELIMINAR_ROLES");
        esperarStatus(put("/api/usuarios/" + superior.id() + "/permisos",
                m("permisoId", idPermiso("VER_PERMISOS"), "otorgado", false), soporte.token()), 403);
    }

    // ---------------- P0-3 ----------------

    @Test
    void p03_modificarUsuariosNoResetealaContrasenaDeUnAdministrador() {
        UsuarioPrueba mod = crearUsuario("MODIFICAR_USUARIOS", "VER_USUARIOS");
        UsuarioPrueba victima = crearAdministrador();
        String hashAntes = jdbc.queryForObject("SELECT contrasena FROM usuarios WHERE id = ?", String.class,
                victima.id());
        esperarStatus(put("/api/usuarios/" + victima.id(), m("contrasena", "Tomada2026xxxx"), mod.token()), 403);
        esperarStatus(put("/api/usuarios/" + victima.id(), m("email", unico("e") + "@atacante.test"), mod.token()),
                403);
        esperarStatus(patch("/api/usuarios/" + victima.id() + "/activo", m("activo", false), mod.token()), 403);
        assertThat(jdbc.queryForObject("SELECT contrasena FROM usuarios WHERE id = ?", String.class, victima.id()))
                .isEqualTo(hashAntes);
        esperarStatus(get("/api/auth/sesion", victima.token()), 200);
    }

    @Test
    void p03_noPuedeResetearSuPropiaContrasenaPorLaAdministracion() {
        UsuarioPrueba mod = crearUsuario("MODIFICAR_USUARIOS", "VER_USUARIOS");
        esperarStatus(put("/api/usuarios/" + mod.id(), m("contrasena", "SinLaActual2026"), mod.token()), 403);
        esperarStatus(patch("/api/usuarios/" + mod.id() + "/activo", m("activo", false), mod.token()), 403);
        esperarStatus(get("/api/auth/sesion", mod.token()), 200);
    }

    @Test
    void p03_eliminarUsuariosNoBorraAdministradoresNiASiMismo() {
        UsuarioPrueba elim = crearUsuario("ELIMINAR_USUARIOS", "VER_USUARIOS");
        UsuarioPrueba victima = crearAdministrador();
        esperarStatus(delete("/api/usuarios/" + victima.id(), elim.token()), 403);
        esperarStatus(delete("/api/usuarios/" + elim.id(), elim.token()), 403);
        assertThat(filas("SELECT COUNT(*) FROM usuarios WHERE id IN (?, ?)", victima.id(), elim.id())).isEqualTo(2);
        // Legitimo: un usuario sin privilegios.
        long raso = crearUsuarioApi(unico("raso"), CONTRASENA_VALIDA);
        esperarStatus(delete("/api/usuarios/" + raso, elim.token()), 200);
    }

    @Test
    void p03_noAdministradorNoQuitaElRolAdministrador() {
        UsuarioPrueba soporte = crearUsuario("ASIGNAR_ROLES", "VER_USUARIOS", "VER_ROLES");
        UsuarioPrueba admin2 = crearAdministrador();
        esperarStatus(delete("/api/usuarios/" + admin2.id() + "/roles/" + idRolAdministrador(), soporte.token()), 403);
    }

    // ---------------- Roles / permisos: auto-beneficio ----------------

    @Test
    void reactivarUnRolExigePoseerSusPermisos() {
        UsuarioPrueba mod = crearUsuario("MODIFICAR_ROLES", "VER_ROLES");
        long rol = crearRol(unico("INACT").toUpperCase(), "ELIMINAR_USUARIOS");
        esperarStatus(patch("/api/roles/" + rol + "/activo", m("activo", false), admin()), 200);
        esperarStatus(patch("/api/roles/" + rol + "/activo", m("activo", true), mod.token()), 403);
    }

    @Test
    void noPuedeModificarNiDesactivarSuPropioRol() {
        UsuarioPrueba mod = crearUsuario("MODIFICAR_ROLES", "VER_ROLES", "ELIMINAR_ROLES");
        esperarStatus(put("/api/roles/" + mod.rolId(), m("descripcion", "hackeado"), mod.token()), 403);
        esperarStatus(patch("/api/roles/" + mod.rolId() + "/activo", m("activo", false), mod.token()), 403);
        esperarStatus(delete("/api/roles/" + mod.rolId(), mod.token()), 403);
    }

    @Test
    void reactivarUnPermisoQueElActorRecibiriaEsAutoConcesion() {
        UsuarioPrueba mod = crearUsuario("MODIFICAR_PERMISOS", "VER_PERMISOS");
        Respuesta p = post("/api/permisos", m("nombre", unico("PROPIO").toUpperCase()), admin());
        long permiso = p.datos().path("id").asLong();
        esperarStatus(post("/api/roles/" + mod.rolId() + "/permisos", m("permisoId", permiso), admin()), 200);
        esperarStatus(patch("/api/permisos/" + permiso + "/activo", m("activo", false), admin()), 200);
        try {
            esperarStatus(patch("/api/permisos/" + permiso + "/activo", m("activo", true), mod.token()), 403);
        } finally {
            // Un permiso inactivo en ADMINISTRADOR rompe la asignacion de ese rol (BUG-2): se restaura.
            esperarStatus(patch("/api/permisos/" + permiso + "/activo", m("activo", true), admin()), 200);
        }
    }

    /**
     * BUG-2 (apitest.md): basta UN permiso inactivo (no base) para que ningun
     * ADMINISTRADOR pueda asignar el rol ADMINISTRADOR: exigirPoseerPermisosDeRol
     * cuenta tambien los permisos inactivos del rol, que nadie "posee".
     */
    @Test
    void bug2_unPermisoInactivoNoImpideQueUnAdministradorAsigneElRolAdministrador() {
        long permiso = post("/api/permisos", m("nombre", unico("INACTIVO").toUpperCase()), admin())
                .datos().path("id").asLong();
        esperarStatus(patch("/api/permisos/" + permiso + "/activo", m("activo", false), admin()), 200);
        try {
            long u = crearUsuarioApi(unico("futuroadmin"), CONTRASENA_VALIDA);
            esperarStatus(post("/api/usuarios/" + u + "/roles", m("rolId", idRolAdministrador()), admin()), 200);
        } finally {
            esperarStatus(patch("/api/permisos/" + permiso + "/activo", m("activo", true), admin()), 200);
        }
    }

    // ---------------- P1-3: nombres reservados ----------------

    @Test
    void p13_noSePuedenOcuparNombresProtegidos() {
        for (String nombre : List.of("@HEHIACHI", "@hehiachi", " @Admin ", "PROTEGIDO.EXTRA")) {
            Respuesta r = post("/api/usuarios", m("usuario", nombre, "contrasena", CONTRASENA_VALIDA, "nombre", "X",
                    "apellido", "Y", "email", unico("r") + "@x.test"), admin());
            esperarStatus(r, 403);
        }
        long u = crearUsuarioApi(unico("ren"), CONTRASENA_VALIDA);
        esperarStatus(put("/api/usuarios/" + u, m("usuario", "@hehiachi"), admin()), 403);
        esperarStatus(put("/api/usuarios/" + u, m("usuario", "@admin"), admin()), 403);
    }

    @Test
    void p32_usuarioIgualAlEmailDeOtraCuentaDa409() {
        long a = crearUsuarioApi(unico("cruce"), CONTRASENA_VALIDA);
        String emailA = jdbc.queryForObject("SELECT email FROM usuarios WHERE id = ?", String.class, a);
        Respuesta r = post("/api/usuarios", m("usuario", emailA, "contrasena", CONTRASENA_VALIDA, "nombre", "X",
                "apellido", "Y", "email", unico("c") + "@x.test"), admin());
        esperarStatus(r, 409);
    }
}
