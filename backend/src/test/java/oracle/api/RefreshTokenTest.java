package oracle.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.util.List;
import oracle.soporte.ApiPrueba;
import org.junit.jupiter.api.Test;

/**
 * Refresh token: cookie HttpOnly, rotacion, deteccion de reutilizacion,
 * vencimientos (inactividad y maximo), logout y revocacion por credenciales.
 */
class RefreshTokenTest extends ApiPrueba {

    private static final String[] AJAX = {"X-Requested-With", "XMLHttpRequest"};

    /** Login que devuelve el refresh token de la cookie (y comprueba sus atributos). */
    private String loginCookie(String usuario, String contrasena) {
        Respuesta r = intentarLogin(usuario, contrasena, ipNueva());
        esperarStatus(r, 200);
        return cookie(r);
    }

    private static String cookie(Respuesta r) {
        List<String> set = r.headers().allValues("Set-Cookie");
        String rt = set.stream().filter(c -> c.startsWith("rt=")).findFirst().orElse(null);
        assertThat(rt).as("Set-Cookie rt en %s", set).isNotNull();
        assertThat(rt).contains("HttpOnly").contains("SameSite=Strict").contains("Path=/api/auth");
        return rt.substring(3, rt.indexOf(';'));
    }

    private Respuesta refresh(String rt) {
        return post("/api/auth/refresh", null, null, "X-Requested-With", "XMLHttpRequest", "Cookie", "rt=" + rt);
    }

    private String hashDe(String rt) throws Exception {
        byte[] h = java.security.MessageDigest.getInstance("SHA-256").digest(rt.getBytes());
        return java.util.HexFormat.of().formatHex(h);
    }

    @Test
    void loginEntregaCookieHttpOnlyYNoGuardaElTokenEnClaro() throws Exception {
        UsuarioPrueba u = crearUsuario();
        String rt = loginCookie(u.usuario(), u.contrasena());
        assertThat(rt).matches("^[A-Za-z0-9_-]{43}$");
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM sesiones_refresh WHERE token_hash = ?", Integer.class,
                hashDe(rt));
        assertThat(n).isEqualTo(1);
    }

    @Test
    void refreshRotaElTokenYDevuelveUnAccessTokenValidoSinContrasena() {
        UsuarioPrueba u = crearUsuario();
        String rt = loginCookie(u.usuario(), u.contrasena());
        Respuesta r = refresh(rt);
        esperarStatus(r, 200);
        String nuevo = cookie(r);
        assertThat(nuevo).isNotEqualTo(rt);
        String access = r.datos().path("token").asString();
        assertThat(access).isNotBlank();
        esperarStatus(get("/api/auth/sesion", access), 200);
        // El sucesor tambien renueva (cadena de rotaciones).
        esperarStatus(refresh(nuevo), 200);
    }

    @Test
    void sinCabeceraAjaxEs400YSinCookieEs401() {
        UsuarioPrueba u = crearUsuario();
        String rt = loginCookie(u.usuario(), u.contrasena());
        esperarStatus(post("/api/auth/refresh", null, null, "Cookie", "rt=" + rt), 400);
        esperarStatus(post("/api/auth/refresh", null, null, AJAX), 401);
        esperarStatus(refresh("x".repeat(43)), 401);
        esperarStatus(refresh("no-es-un-token"), 401);
    }

    @Test
    void reutilizarUnTokenRotadoFueraDeLaGraciaRevocaTodaLaSesion() throws Exception {
        UsuarioPrueba u = crearUsuario();
        String viejo = loginCookie(u.usuario(), u.contrasena());
        Respuesta r = refresh(viejo);
        esperarStatus(r, 200);
        String vigente = cookie(r);
        // Simula que la rotacion fue hace un minuto (fuera de la ventana de gracia).
        jdbc.update("UPDATE sesiones_refresh SET revocado_en = now() - interval '1 minute' WHERE token_hash = ?",
                hashDe(viejo));

        esperarStatus(refresh(viejo), 401);
        esperarStatus(refresh(vigente), 401); // el ladron y la victima pierden la sesion
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM auditoria_eventos WHERE accion = 'SESION_REUTILIZADA' AND entidad_id = ?",
                Integer.class, String.valueOf(u.id()))).isEqualTo(1));
    }

    @Test
    void dentroDeLaGraciaDosPestanasPuedenRenovarALaVez() {
        UsuarioPrueba u = crearUsuario();
        String rt = loginCookie(u.usuario(), u.contrasena());
        Respuesta a = refresh(rt);
        Respuesta b = refresh(rt); // misma cookie, segundos despues
        esperarStatus(a, 200);
        esperarStatus(b, 200);
        esperarStatus(refresh(cookie(a)), 200);
        esperarStatus(refresh(cookie(b)), 200);
    }

    @Test
    void venceSinActividadYAlMaximoDeLaSesion() throws Exception {
        UsuarioPrueba u = crearUsuario();
        String inactivo = loginCookie(u.usuario(), u.contrasena());
        jdbc.update("UPDATE sesiones_refresh SET expira_en = now() - interval '1 second' WHERE token_hash = ?",
                hashDe(inactivo));
        esperarStatus(refresh(inactivo), 401);

        String alMaximo = loginCookie(u.usuario(), u.contrasena());
        jdbc.update("""
                UPDATE sesiones_refresh SET expira_en = now() - interval '1 second',
                       familia_expira_en = now() - interval '1 second' WHERE token_hash = ?""", hashDe(alMaximo));
        esperarStatus(refresh(alMaximo), 401);
    }

    @Test
    void logoutRevocaLaSesionYBorraLaCookie() {
        UsuarioPrueba u = crearUsuario();
        String rt = loginCookie(u.usuario(), u.contrasena());
        Respuesta r = post("/api/auth/logout", null, null, "X-Requested-With", "XMLHttpRequest", "Cookie", "rt=" + rt);
        esperarStatus(r, 200);
        assertThat(r.headers().allValues("Set-Cookie")).anyMatch(c -> c.startsWith("rt=;") && c.contains("Max-Age=0"));
        esperarStatus(refresh(rt), 401);
        // Idempotente: sin cookie o repetido tambien responde 200.
        esperarStatus(post("/api/auth/logout", null, null, AJAX), 200);
    }

    @Test
    void cerrarSesionesDesdeAdministracionRevocaElRefresh() {
        UsuarioPrueba u = crearUsuario();
        String rt = loginCookie(u.usuario(), u.contrasena());
        esperarStatus(post("/api/usuarios/" + u.id() + "/sesiones/cerrar", m("motivo", "prueba"), admin()), 200);
        esperarStatus(refresh(rt), 401);
    }

    @Test
    void desactivarLaCuentaRevocaElRefresh() {
        UsuarioPrueba u = crearUsuario();
        String rt = loginCookie(u.usuario(), u.contrasena());
        esperarStatus(patch("/api/usuarios/" + u.id() + "/activo", m("activo", false), admin()), 200);
        esperarStatus(refresh(rt), 401);
    }

    @Test
    void cambiarLaContrasenaRevocaLasDemasSesionesYMantieneLaActual() {
        UsuarioPrueba u = crearUsuario();
        String otraPestana = loginCookie(u.usuario(), u.contrasena());
        Respuesta login = intentarLogin(u.usuario(), u.contrasena(), ipNueva());
        String access = login.datos().path("token").asString();

        Respuesta cambio = put("/api/auth/contrasena",
                m("contrasenaActual", u.contrasena(), "contrasenaNueva", "OtraClave2026xy"), access);
        esperarStatus(cambio, 200);
        String deEstaSesion = cookie(cambio);

        esperarStatus(refresh(otraPestana), 401);
        esperarStatus(refresh(deEstaSesion), 200);
    }
}
