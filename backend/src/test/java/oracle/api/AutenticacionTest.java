package oracle.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import javax.crypto.spec.SecretKeySpec;
import oracle.soporte.ApiPrueba;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import tools.jackson.databind.JsonNode;

/** Login, bloqueo por cuenta, limitador (429), validez y revocacion del JWT. */
class AutenticacionTest extends ApiPrueba {

    private static final String GENERICO = "Usuario o contraseña incorrectos.";

    // ------------------------------------------------------------------
    @Nested
    @DisplayName("Login")
    class Login {

        @Test
        void loginCorrectoDevuelveTokenUsuarioYPermisos() {
            Respuesta r = intentarLogin(ADMIN, ADMIN_CONTRASENA, ipNueva());
            esperarStatus(r, 200);
            JsonNode d = r.datos();
            assertThat(r.json().path("exito").asBoolean()).isTrue();
            assertThat(d.path("token").asString()).isNotBlank();
            assertThat(d.path("tipo").asString()).isEqualTo("Bearer");
            assertThat(Instant.parse(d.path("expiraEn").asString())).isAfter(Instant.now().plusSeconds(3000));
            assertThat(d.path("usuario").path("usuario").asString()).isEqualTo(ADMIN);
            assertThat(d.path("usuario").path("protegido").asBoolean()).isTrue();
            assertThat(d.path("usuario").has("contrasena")).isFalse();
            assertThat(textos(d.path("permisos"))).contains("VER_AUDITORIA", "ASIGNAR_ROLES", "VER_USUARIOS");
            assertThat(r.cuerpo()).doesNotContain("$2a$").doesNotContain("$2b$");
        }

        @Test
        void loginPorEmailFunciona() {
            UsuarioPrueba u = crearUsuario();
            esperarStatus(intentarLogin(u.usuario() + "@pruebas.test", u.contrasena(), ipNueva()), 200);
        }

        @Test
        void contrasenaIncorrectaYUsuarioInexistenteDanElMismo401Generico() {
            UsuarioPrueba u = crearUsuario();
            Respuesta mala = intentarLogin(u.usuario(), "NoEsLaClave2026", ipNueva());
            Respuesta inexistente = intentarLogin(unico("fantasma"), "NoEsLaClave2026", ipNueva());
            esperarStatus(mala, 401);
            esperarStatus(inexistente, 401);
            assertThat(mala.json().path("mensaje").asString()).isEqualTo(GENERICO);
            assertThat(inexistente.json().path("mensaje").asString()).isEqualTo(GENERICO);
        }

        @Test
        void cuentaDesactivadaConClaveCorrectaDaElMismo401Generico() {
            UsuarioPrueba u = crearUsuario();
            esperarStatus(patch("/api/usuarios/" + u.id() + "/activo", m("activo", false), admin()), 200);
            Respuesta r = intentarLogin(u.usuario(), u.contrasena(), ipNueva());
            esperarStatus(r, 401);
            assertThat(r.json().path("mensaje").asString()).isEqualTo(GENERICO);
        }

        @Test
        void cuerpoInvalidoDa400ConCampos() {
            Respuesta r = post("/api/auth/login", m("usuario", "", "contrasena", ""), null,
                    "X-Forwarded-For", ipNueva());
            esperarStatus(r, 400);
            assertThat(r.json().path("campos").has("usuario")).isTrue();
            assertThat(r.json().path("campos").has("contrasena")).isTrue();
            esperarStatus(post("/api/auth/login", "{no es json", null), 400);
        }

        /**
         * Regresion: una contrasena de login de 73-100 bytes pasa @Size(max=100)
         * y llega a BCrypt.matches; no debe convertirse en 500 (hoy da 401).
         */
        @Test
        void contrasenaDeLoginDeMasDe72BytesNoDa500() {
            UsuarioPrueba u = crearUsuario();
            Respuesta r = intentarLogin(u.usuario(), "a1".repeat(40), ipNueva());
            assertThat(r.status()).as("respuesta: %s", r).isIn(400, 401);
        }
    }

    // ------------------------------------------------------------------
    @Nested
    @DisplayName("Bloqueo por cuenta y limitador")
    class Bloqueo {

        @Test
        void cincoFallosBloqueanLaCuentaAunqueLuegoLaClaveSeaCorrecta() {
            UsuarioPrueba u = crearUsuario();
            for (int i = 0; i < 5; i++) {
                esperarStatus(intentarLogin(u.usuario(), "Incorrecta2026x", ipNueva()), 401);
            }
            Map<String, Object> fila = jdbc.queryForMap(
                    "SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE id = ?", u.id());
            assertThat(((Number) fila.get("intentos_fallidos")).intValue()).isEqualTo(5);
            assertThat(((Timestamp) fila.get("bloqueado_hasta")).toInstant()).isAfter(Instant.now().minusSeconds(5));

            Respuesta conClaveBuena = intentarLogin(u.usuario(), u.contrasena(), ipNueva());
            esperarStatus(conClaveBuena, 401);
            assertThat(conClaveBuena.json().path("mensaje").asString()).isEqualTo(GENERICO);

            List<JsonNode> ev = esperarEventos("relacionadoCon=USUARIO:" + u.id() + "&accion=LOGIN_BLOQUEADO",
                    l -> !l.isEmpty());
            assertThat(ev.get(0).path("resultado").asString()).isEqualTo("DENEGADO");
            assertThat(ev.get(0).path("detalle").path("motivo").asString()).isEqualTo("cuenta_bloqueada");
            List<JsonNode> fallidos = esperarEventos("relacionadoCon=USUARIO:" + u.id() + "&accion=LOGIN_FALLIDO",
                    l -> l.size() >= 5);
            assertThat(fallidos.get(0).path("actorUsuario").asString()).isEqualTo(u.usuario());
            assertThat(fallidos.get(0).path("detalle").path("bloqueada").asBoolean()).isTrue();

            // Al vencer el bloqueo (simulado) la clave correcta entra y el contador vuelve a 0.
            jdbc.update("UPDATE usuarios SET bloqueado_hasta = now() - interval '1 second' WHERE id = ?", u.id());
            esperarStatus(intentarLogin(u.usuario(), u.contrasena(), ipNueva()), 200);
            assertThat(jdbc.queryForObject("SELECT intentos_fallidos FROM usuarios WHERE id = ?", Integer.class,
                    u.id())).isZero();
        }

        @Test
        void unLoginCorrectoReiniciaElContadorDeFallos() {
            UsuarioPrueba u = crearUsuario();
            for (int i = 0; i < 3; i++) {
                esperarStatus(intentarLogin(u.usuario(), "Incorrecta2026x", ipNueva()), 401);
            }
            esperarStatus(intentarLogin(u.usuario(), u.contrasena(), ipNueva()), 200);
            for (int i = 0; i < 3; i++) {
                esperarStatus(intentarLogin(u.usuario(), "Incorrecta2026x", ipNueva()), 401);
            }
            esperarStatus(intentarLogin(u.usuario(), u.contrasena(), ipNueva()), 200);
        }

        @Test
        void elUsuarioRaizTambienSeBloqueaYElTriggerLoPermite() {
            long raiz = asegurarUsuarioRaiz();
            try {
                for (int i = 0; i < 5; i++) {
                    esperarStatus(intentarLogin(RAIZ, "Incorrecta2026x", ipNueva()), 401);
                }
                esperarStatus(intentarLogin(RAIZ, RAIZ_CONTRASENA, ipNueva()), 401);
            } finally {
                jdbc.update("UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?", raiz);
            }
            esperarStatus(intentarLogin(RAIZ, RAIZ_CONTRASENA, ipNueva()), 200);
        }

        @Test
        void diezIntentosPorIpYUsuarioDespues429ConRetryAfter() {
            String ip = ipNueva();
            String usuario = unico("rafaga");
            for (int i = 0; i < 10; i++) {
                esperarStatus(intentarLogin(usuario, "Incorrecta2026x", ip), 401);
            }
            String rid = "rl-" + unico("x").replace('_', '-');
            Respuesta r = post("/api/auth/login", m("usuario", usuario, "contrasena", "Incorrecta2026x"), null,
                    "X-Forwarded-For", ip, "X-Request-Id", rid);
            esperarStatus(r, 429);
            assertThat(r.header("Retry-After")).isEqualTo("60");
            // Otra IP no comparte el cubo IP+usuario.
            esperarStatus(intentarLogin(usuario, "Incorrecta2026x", ipNueva()), 401);

            List<JsonNode> ev = esperarEventos("q=" + rid, l -> !l.isEmpty());
            JsonNode e = unoConAccion(ev, "LOGIN_BLOQUEADO");
            assertThat(e.path("detalle").path("motivo").asString()).isEqualTo("limite_de_intentos");
            assertThat(e.path("ip").asString()).isEqualTo(ip);
        }

        @Test
        void treintaIntentosPorIpConUsuariosDistintosDespues429() {
            String ip = ipNueva();
            for (int i = 0; i < 30; i++) {
                esperarStatus(intentarLogin(unico("rot"), "Incorrecta2026x", ip), 401);
            }
            esperarStatus(intentarLogin(unico("rot"), "Incorrecta2026x", ip), 429);
        }
    }

    // ------------------------------------------------------------------
    @Nested
    @DisplayName("JWT")
    class Jwt {

        private String firmar(String secreto, String emisor, String sub, Integer ver, Instant emitido, Instant expira) {
            var enc = new NimbusJwtEncoder(new ImmutableSecret<>(
                    new SecretKeySpec(secreto.getBytes(StandardCharsets.UTF_8), "HmacSHA256")));
            JwtClaimsSet.Builder c = JwtClaimsSet.builder().issuer(emisor).subject(sub).issuedAt(emitido)
                    .expiresAt(expira);
            if (ver != null) {
                c.claim("ver", ver);
            }
            return enc.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), c.build()))
                    .getTokenValue();
        }

        private int version(long id) {
            return jdbc.queryForObject("SELECT credenciales_version FROM usuarios WHERE id = ?", Integer.class, id);
        }

        @Test
        void sinTokenTokenBasuraYEsquemaIncorrectoDan401Json() {
            Respuesta sin = get("/api/auth/sesion", null);
            esperarStatus(sin, 401);
            assertThat(sin.header("Content-Type")).contains("application/json");
            assertThat(sin.json().path("status").asInt()).isEqualTo(401);
            esperarStatus(get("/api/auth/sesion", "no.es.un-jwt"), 401);
            esperarStatus(get("/api/usuarios", null, "Authorization", "Basic YWRtaW46YWRtaW4="), 401);
        }

        @Test
        void tokenValidoFirmadoAMano() {
            UsuarioPrueba u = crearUsuario();
            String t = firmar(JWT_SECRETO, JWT_EMISOR, String.valueOf(u.id()), version(u.id()), Instant.now(),
                    Instant.now().plusSeconds(600));
            esperarStatus(get("/api/auth/sesion", t), 200);
        }

        @Test
        void firmaConOtroSecretoDa401() {
            UsuarioPrueba u = crearUsuario();
            String t = firmar("otro-secreto-de-32-bytes-como-minimo-xx", JWT_EMISOR, String.valueOf(u.id()),
                    version(u.id()), Instant.now(), Instant.now().plusSeconds(600));
            esperarStatus(get("/api/auth/sesion", t), 401);
        }

        @Test
        void tokenExpiradoDa401() {
            UsuarioPrueba u = crearUsuario();
            Instant ahora = Instant.now();
            String t = firmar(JWT_SECRETO, JWT_EMISOR, String.valueOf(u.id()), version(u.id()),
                    ahora.minus(2, ChronoUnit.HOURS), ahora.minus(10, ChronoUnit.MINUTES));
            esperarStatus(get("/api/auth/sesion", t), 401);
        }

        @Test
        void emisorIncorrectoSinClaimVerSubNoNumericoYAlgNoneDan401() {
            UsuarioPrueba u = crearUsuario();
            Instant ahora = Instant.now();
            Instant exp = ahora.plusSeconds(600);
            String sub = String.valueOf(u.id());
            esperarStatus(get("/api/auth/sesion", firmar(JWT_SECRETO, "otro-emisor", sub, version(u.id()), ahora, exp)), 401);
            esperarStatus(get("/api/auth/sesion", firmar(JWT_SECRETO, JWT_EMISOR, sub, null, ahora, exp)), 401);
            esperarStatus(get("/api/auth/sesion", firmar(JWT_SECRETO, JWT_EMISOR, "abc", 0, ahora, exp)), 401);
            esperarStatus(get("/api/auth/sesion", firmar(JWT_SECRETO, JWT_EMISOR, "99999999", 0, ahora, exp)), 401);

            Base64.Encoder b64 = Base64.getUrlEncoder().withoutPadding();
            String none = b64.encodeToString("{\"alg\":\"none\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8))
                    + "." + b64.encodeToString(("{\"iss\":\"" + JWT_EMISOR + "\",\"sub\":\"" + sub + "\",\"ver\":"
                    + version(u.id()) + ",\"exp\":" + exp.getEpochSecond() + "}").getBytes(StandardCharsets.UTF_8)) + ".";
            esperarStatus(get("/api/auth/sesion", none), 401);
        }

        @Test
        void cambioDePropiaContrasenaRevocaTokensAnterioresYDevuelveUnoNuevo() {
            UsuarioPrueba u = crearUsuario();
            String otraSesion = login(u.usuario(), u.contrasena());
            int antes = version(u.id());
            String nueva = "NuevaClave2026xy";
            Respuesta r = put("/api/auth/contrasena", m("contrasenaActual", u.contrasena(), "contrasenaNueva", nueva),
                    u.token());
            esperarStatus(r, 200);
            String tokenNuevo = r.datos().path("token").asString();
            assertThat(tokenNuevo).isNotBlank().isNotEqualTo(u.token());
            assertThat(version(u.id())).isEqualTo(antes + 1);

            esperarStatus(get("/api/auth/sesion", u.token()), 401);
            esperarStatus(get("/api/auth/sesion", otraSesion), 401);
            esperarStatus(get("/api/auth/sesion", tokenNuevo), 200);
            esperarStatus(intentarLogin(u.usuario(), u.contrasena(), ipNueva()), 401);
            esperarStatus(intentarLogin(u.usuario(), nueva, ipNueva()), 200);

            List<JsonNode> ev = esperarEventos("relacionadoCon=USUARIO:" + u.id() + "&accion=CONTRASENA_CAMBIADA",
                    l -> !l.isEmpty());
            assertThat(ev.get(0).path("resultado").asString()).isEqualTo("EXITO");
            assertThat(ev.get(0).toString()).doesNotContain(nueva).doesNotContain(u.contrasena());
        }

        @Test
        void cambioDeContrasenaConActualIncorrectaIgualODebilFalla() {
            UsuarioPrueba u = crearUsuario();
            esperarStatus(put("/api/auth/contrasena",
                    m("contrasenaActual", "NoEsLaActual2026", "contrasenaNueva", "NuevaClave2026xy"), u.token()), 401);
            esperarStatus(put("/api/auth/contrasena",
                    m("contrasenaActual", u.contrasena(), "contrasenaNueva", u.contrasena()), u.token()), 403);
            Respuesta debil = put("/api/auth/contrasena",
                    m("contrasenaActual", u.contrasena(), "contrasenaNueva", "corta1"), u.token());
            esperarStatus(debil, 400);
            assertThat(debil.json().path("campos").has("contrasenaNueva")).isTrue();
            Respuesta larga = put("/api/auth/contrasena",
                    m("contrasenaActual", u.contrasena(), "contrasenaNueva", "ñ".repeat(40) + "a1"), u.token());
            esperarStatus(larga, 400);
            assertThat(larga.json().path("campos").has("contrasenaNueva")).isTrue();
            // El token sigue valido: nada cambio.
            esperarStatus(get("/api/auth/sesion", u.token()), 200);
            esperarEventos("relacionadoCon=USUARIO:" + u.id() + "&accion=CONTRASENA_CAMBIADA&resultado=FALLO",
                    l -> !l.isEmpty());
        }

        /** Regresion: contrasenaActual de 73-100 bytes llega a BCrypt.matches (hoy 401, nunca 500). */
        @Test
        void contrasenaActualDeMasDe72BytesNoDa500() {
            UsuarioPrueba u = crearUsuario();
            Respuesta r = put("/api/auth/contrasena",
                    m("contrasenaActual", "a1".repeat(40), "contrasenaNueva", "NuevaClave2026xy"), u.token());
            assertThat(r.status()).as("respuesta: %s", r).isIn(400, 401);
        }

        @Test
        void resetPorAdminRenombradoDesactivacionYBorradoRevocanElToken() {
            UsuarioPrueba a = crearUsuario();
            esperarStatus(put("/api/usuarios/" + a.id(), m("contrasena", "ResetAdmin2026x"), admin()), 200);
            esperarStatus(get("/api/auth/sesion", a.token()), 401);

            UsuarioPrueba b = crearUsuario();
            esperarStatus(put("/api/usuarios/" + b.id(), m("usuario", unico("ren")), admin()), 200);
            esperarStatus(get("/api/auth/sesion", b.token()), 401);

            UsuarioPrueba c = crearUsuario();
            esperarStatus(patch("/api/usuarios/" + c.id() + "/activo", m("activo", false), admin()), 200);
            esperarStatus(get("/api/auth/sesion", c.token()), 401);
            esperarStatus(patch("/api/usuarios/" + c.id() + "/activo", m("activo", true), admin()), 200);
            esperarStatus(get("/api/auth/sesion", c.token()), 401); // reactivar no resucita tokens viejos
            esperarStatus(intentarLogin(c.usuario(), c.contrasena(), ipNueva()), 200);

            UsuarioPrueba d = crearUsuario();
            esperarStatus(delete("/api/usuarios/" + d.id(), admin()), 200);
            esperarStatus(get("/api/auth/sesion", d.token()), 401);
        }

        @Test
        void cambioDeNombreODatosNoSensiblesNoRevoca() {
            UsuarioPrueba u = crearUsuario();
            esperarStatus(put("/api/usuarios/" + u.id(), m("nombre", "Otro", "telefono", "999"), admin()), 200);
            esperarStatus(get("/api/auth/sesion", u.token()), 200);
        }

        @Test
        void elUsuarioRaizNoPuedeCambiarSuContrasenaDesdeLaApi() {
            asegurarUsuarioRaiz();
            String t = login(RAIZ, RAIZ_CONTRASENA);
            esperarStatus(put("/api/auth/contrasena",
                    m("contrasenaActual", RAIZ_CONTRASENA, "contrasenaNueva", "OtraRaiz2026xy"), t), 403);
            esperarStatus(get("/api/auth/sesion", t), 200);
        }

        @Test
        void sesionDevuelveUsuarioYPermisosVigentes() {
            UsuarioPrueba u = crearUsuario("VER_ROLES");
            Respuesta r = get("/api/auth/sesion", u.token());
            esperarStatus(r, 200);
            assertThat(r.datos().path("usuario").path("id").asLong()).isEqualTo(u.id());
            assertThat(textos(r.datos().path("permisos"))).containsExactly("VER_ROLES");
        }
    }
}
