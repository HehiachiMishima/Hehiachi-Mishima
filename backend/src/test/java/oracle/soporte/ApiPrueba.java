package oracle.soporte;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Base de las pruebas de la API: arranca la aplicacion completa en un puerto
 * aleatorio (filtros, seguridad, dispatch async de Mono, Tomcat real) contra el
 * MySQL 8.4 de {@link BaseDatosPrueba}, y ofrece un cliente HTTP minimo.
 *
 * Todas las clases que heredan comparten la MISMA configuracion, de modo que
 * Spring reutiliza un unico contexto. Cada prueba crea sus propios datos con
 * nombres unicos (no hay limpieza entre pruebas) y filtra la bitacora por los
 * ids que ella misma creo.
 *
 * El limitador de login es por IP: cada login de los helpers usa una IP
 * distinta en X-Forwarded-For (Tomcat confia en 127.0.0.1 como proxy interno,
 * server.forward-headers-strategy=native), salvo las pruebas que lo ejercitan.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class ApiPrueba {

    public static final String ADMIN = "@admin";
    public static final String ADMIN_CONTRASENA = "AdminPrueba2026x";
    public static final String USUARIO_PROTEGIDO_EXTRA = "protegido.extra";
    /** Secreto HS256 SOLO de pruebas (64 hex). */
    public static final String JWT_SECRETO = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    public static final String JWT_EMISOR = "pruebas";
    public static final String CONTRASENA_VALIDA = "ClavePrueba2026x";

    protected static final JsonMapper JSON = JsonMapper.builder().build();

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private static final AtomicInteger SECUENCIA = new AtomicInteger();
    private static final AtomicInteger SECUENCIA_IP = new AtomicInteger(1);
    private static final Map<Integer, String> TOKEN_ADMIN = new ConcurrentHashMap<>();
    private static final Map<String, Long> PERMISOS = new ConcurrentHashMap<>();
    private static final String SUFIJO_EJECUCION = Long.toString(System.currentTimeMillis() % 100_000, 36);

    @LocalServerPort
    protected int puerto;

    @Autowired
    protected JdbcTemplate jdbc;

    @DynamicPropertySource
    static void propiedades(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", BaseDatosPrueba::jdbcUrl);
        r.add("spring.datasource.username", BaseDatosPrueba::usuario);
        r.add("spring.datasource.password", BaseDatosPrueba::contrasena);
        r.add("spring.datasource.hikari.maximum-pool-size", () -> "20");
        r.add("spring.datasource.hikari.minimum-idle", () -> "2");
        r.add("app.jwt.secret", () -> JWT_SECRETO);
        r.add("app.jwt.issuer", () -> JWT_EMISOR);
        r.add("app.jwt.ttl-ms", () -> "3600000");
        r.add("app.seed.usuario", () -> ADMIN);
        r.add("app.seed.contrasena", () -> ADMIN_CONTRASENA);
        r.add("app.seed.nombre", () -> "Admin");
        r.add("app.seed.apellido", () -> "Pruebas");
        r.add("app.seed.email", () -> "admin@pruebas.test");
        r.add("app.seed.telefono", () -> "");
        r.add("app.seed.rol", () -> "ADMINISTRADOR");
        r.add("app.seed.activo", () -> "true");
        r.add("app.seguridad.usuarios-protegidos", () -> USUARIO_PROTEGIDO_EXTRA);
        r.add("app.seguridad.bcrypt-coste", ApiPrueba::costeBcrypt);
        r.add("app.seguridad.bloqueo.umbral", () -> "5");
        r.add("app.seguridad.bloqueo.max-minutos", () -> "60");
        r.add("app.cors.allowed-origins", () -> "http://localhost:4200");
        r.add("app.stats-cache.ttl-ms", () -> "1000");
    }

    /** BCrypt barato en la suite funcional; la prueba de carga lo sube a 10 (valor de produccion). */
    static String costeBcrypt() {
        return System.getProperty("pruebas.bcrypt-coste", "4");
    }

    // ------------------------------------------------------------------
    // Cliente HTTP
    // ------------------------------------------------------------------

    /** Respuesta HTTP ya leida. */
    public record Respuesta(int status, HttpHeaders headers, String cuerpo) {

        public JsonNode json() {
            return cuerpo == null || cuerpo.isBlank() ? JSON.nullNode() : JSON.readTree(cuerpo);
        }

        public JsonNode datos() {
            return json().path("datos");
        }

        public String mensaje() {
            return json().path("mensaje").asString("");
        }

        public String header(String nombre) {
            return headers.firstValue(nombre).orElse(null);
        }

        @Override
        public String toString() {
            return status + " " + (cuerpo == null ? "" : cuerpo.substring(0, Math.min(400, cuerpo.length())));
        }
    }

    protected String base() {
        return "http://127.0.0.1:" + puerto;
    }

    /** Llamada generica. cabeceras = pares nombre, valor. */
    protected Respuesta llamar(String metodo, String ruta, Object cuerpo, String token, String... cabeceras) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base() + ruta))
                    .timeout(Duration.ofSeconds(60));
            String json = cuerpo == null ? null : (cuerpo instanceof String s ? s : JSON.writeValueAsString(cuerpo));
            b.method(metodo, json == null ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8));
            if (json != null) {
                b.header("Content-Type", "application/json");
            }
            if (token != null) {
                b.header("Authorization", "Bearer " + token);
            }
            for (int i = 0; i + 1 < cabeceras.length; i += 2) {
                b.header(cabeceras[i], cabeceras[i + 1]);
            }
            HttpResponse<String> r = HTTP.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return new Respuesta(r.statusCode(), r.headers(), r.body());
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("Fallo HTTP " + metodo + " " + ruta, ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(ex);
        }
    }

    protected Respuesta get(String ruta, String token, String... cabeceras) {
        return llamar("GET", ruta, null, token, cabeceras);
    }

    protected Respuesta post(String ruta, Object cuerpo, String token, String... cabeceras) {
        return llamar("POST", ruta, cuerpo, token, cabeceras);
    }

    protected Respuesta put(String ruta, Object cuerpo, String token, String... cabeceras) {
        return llamar("PUT", ruta, cuerpo, token, cabeceras);
    }

    protected Respuesta patch(String ruta, Object cuerpo, String token, String... cabeceras) {
        return llamar("PATCH", ruta, cuerpo, token, cabeceras);
    }

    protected Respuesta delete(String ruta, String token, String... cabeceras) {
        return llamar("DELETE", ruta, null, token, cabeceras);
    }

    protected static String q(String valor) {
        return URLEncoder.encode(valor, StandardCharsets.UTF_8);
    }

    /** Mapa JSON ordenado a partir de pares clave, valor. */
    protected static Map<String, Object> m(Object... kv) {
        Map<String, Object> mapa = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            mapa.put((String) kv[i], kv[i + 1]);
        }
        return mapa;
    }

    protected static void esperarStatus(Respuesta r, int esperado) {
        assertThat(r.status()).as("respuesta: %s", r).isEqualTo(esperado);
    }

    // ------------------------------------------------------------------
    // Autenticacion
    // ------------------------------------------------------------------

    /** IP sintetica unica (10.x.y.z) para no compartir cubos del limitador. */
    protected static String ipNueva() {
        int n = SECUENCIA_IP.incrementAndGet();
        return "10." + ((n >> 16) & 0xff) + "." + ((n >> 8) & 0xff) + "." + (n & 0xff);
    }

    protected Respuesta intentarLogin(String usuario, String contrasena, String ip) {
        return post("/api/auth/login", m("usuario", usuario, "contrasena", contrasena), null,
                "X-Forwarded-For", ip);
    }

    protected String login(String usuario, String contrasena) {
        Respuesta r = intentarLogin(usuario, contrasena, ipNueva());
        esperarStatus(r, 200);
        return r.datos().path("token").asString();
    }

    protected String admin() {
        return TOKEN_ADMIN.computeIfAbsent(puerto, p -> login(ADMIN, ADMIN_CONTRASENA));
    }

    /** Id del usuario semilla. */
    protected long idAdmin() {
        return jdbc.queryForObject("SELECT id FROM usuarios WHERE usuario = ?", Long.class, ADMIN);
    }

    // ------------------------------------------------------------------
    // Datos de prueba
    // ------------------------------------------------------------------

    /** Nombre unico (<= 30 caracteres) para no colisionar entre pruebas ni ejecuciones. */
    protected static String unico(String prefijo) {
        return prefijo + "_" + SUFIJO_EJECUCION + "_" + SECUENCIA.incrementAndGet()
                + Integer.toString(ThreadLocalRandom.current().nextInt(36 * 36), 36);
    }

    protected long idPermiso(String nombre) {
        Long id = PERMISOS.get(nombre);
        if (id == null) {
            Respuesta r = get("/api/permisos", admin());
            esperarStatus(r, 200);
            for (JsonNode p : r.datos()) {
                PERMISOS.put(p.path("nombre").asString(), p.path("id").asLong());
            }
            id = PERMISOS.get(nombre);
        }
        assertThat(id).as("permiso %s", nombre).isNotNull();
        return id;
    }

    protected long idRolAdministrador() {
        return jdbc.queryForObject("SELECT id FROM roles WHERE nombre = 'ADMINISTRADOR'", Long.class);
    }

    protected long crearRol(String nombre, String... permisos) {
        Respuesta r = post("/api/roles", m("nombre", nombre, "descripcion", "rol de prueba"), admin());
        esperarStatus(r, 200);
        long rolId = r.datos().path("id").asLong();
        for (String p : permisos) {
            esperarStatus(post("/api/roles/" + rolId + "/permisos", m("permisoId", idPermiso(p)), admin()), 200);
        }
        return rolId;
    }

    protected long crearUsuarioApi(String usuario, String contrasena) {
        Respuesta r = post("/api/usuarios", m("usuario", usuario, "contrasena", contrasena, "nombre", "Nombre",
                "apellido", "Apellido", "email", usuario.replaceAll("[^A-Za-z0-9_.-]", "") + "@pruebas.test"), admin());
        esperarStatus(r, 200);
        return r.datos().path("id").asLong();
    }

    /** Usuario de prueba ya autenticado. */
    public record UsuarioPrueba(long id, String usuario, String contrasena, String token, Long rolId) {
    }

    /** Crea un usuario con un rol propio que tiene exactamente estos permisos (o sin rol si no hay). */
    protected UsuarioPrueba crearUsuario(String... permisos) {
        String nombre = unico("u");
        long id = crearUsuarioApi(nombre, CONTRASENA_VALIDA);
        Long rolId = null;
        if (permisos.length > 0) {
            rolId = crearRol(unico("R").toUpperCase(), permisos);
            esperarStatus(post("/api/usuarios/" + id + "/roles", m("rolId", rolId), admin()), 200);
        }
        return new UsuarioPrueba(id, nombre, CONTRASENA_VALIDA, login(nombre, CONTRASENA_VALIDA), rolId);
    }

    /** Crea un usuario con el rol ADMINISTRADOR (lo asigna el admin semilla). */
    protected UsuarioPrueba crearAdministrador() {
        String nombre = unico("adm");
        long id = crearUsuarioApi(nombre, CONTRASENA_VALIDA);
        esperarStatus(post("/api/usuarios/" + id + "/roles", m("rolId", idRolAdministrador()), admin()), 200);
        return new UsuarioPrueba(id, nombre, CONTRASENA_VALIDA, login(nombre, CONTRASENA_VALIDA),
                idRolAdministrador());
    }

    public static final String RAIZ = "@hehiachi";
    public static final String RAIZ_CONTRASENA = "RaizPrueba2026x";

    /**
     * Crea (una vez) al usuario raiz @hehiachi con el rol ADMINISTRADOR por SQL,
     * como lo haria el DBA: la API no permite ocupar ese nombre.
     */
    protected synchronized long asegurarUsuarioRaiz() {
        List<Long> ids = jdbc.queryForList("SELECT id FROM usuarios WHERE usuario = ?", Long.class, RAIZ);
        if (!ids.isEmpty()) {
            return ids.get(0);
        }
        String hash = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(4).encode(RAIZ_CONTRASENA);
        jdbc.update("INSERT INTO usuarios (usuario, contrasena, nombre, apellido, email, activo, creado_por, "
                + "actualizado_por) VALUES (?, ?, 'Raiz', 'Pruebas', 'raiz@pruebas.test', TRUE, 0, 0)", RAIZ, hash);
        long id = jdbc.queryForObject("SELECT id FROM usuarios WHERE usuario = ?", Long.class, RAIZ);
        jdbc.update("INSERT INTO usuarios_roles (usuario_id, rol_id, creado_por) VALUES (?, ?, 0)",
                id, idRolAdministrador());
        return id;
    }

    /** Crea por SQL al usuario protegido por configuracion (app.seguridad.usuarios-protegidos). */
    protected synchronized long asegurarUsuarioProtegidoExtra() {
        List<Long> ids = jdbc.queryForList("SELECT id FROM usuarios WHERE usuario = ?", Long.class,
                USUARIO_PROTEGIDO_EXTRA);
        if (!ids.isEmpty()) {
            return ids.get(0);
        }
        String hash = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(4).encode(CONTRASENA_VALIDA);
        jdbc.update("INSERT INTO usuarios (usuario, contrasena, nombre, apellido, email, activo, creado_por, "
                + "actualizado_por) VALUES (?, ?, 'Prot', 'Extra', 'prot.extra@pruebas.test', TRUE, 0, 0)",
                USUARIO_PROTEGIDO_EXTRA, hash);
        return jdbc.queryForObject("SELECT id FROM usuarios WHERE usuario = ?", Long.class, USUARIO_PROTEGIDO_EXTRA);
    }

    protected static List<String> nombres(JsonNode arreglo, String campo) {
        List<String> l = new ArrayList<>();
        for (JsonNode n : arreglo) {
            l.add(n.path(campo).asString());
        }
        return l;
    }

    protected static List<String> textos(JsonNode arreglo) {
        List<String> l = new ArrayList<>();
        for (JsonNode n : arreglo) {
            l.add(n.asString());
        }
        return l;
    }

    // ------------------------------------------------------------------
    // Bitacora (escritura asincrona: hay que esperar)
    // ------------------------------------------------------------------

    /** Eventos de GET /api/auditoria?{query} (tamano 100) visibles para el admin. */
    protected List<JsonNode> eventos(String query) {
        Respuesta r = get("/api/auditoria?tamano=100&" + query, admin());
        esperarStatus(r, 200);
        List<JsonNode> l = new ArrayList<>();
        r.datos().path("contenido").forEach(l::add);
        return l;
    }

    /** Espera (max. 30 s) a que la consulta devuelva eventos que cumplan la condicion. */
    protected List<JsonNode> esperarEventos(String query, Predicate<List<JsonNode>> condicion) {
        List<List<JsonNode>> ultimo = new ArrayList<>(List.of(List.of()));
        await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(150))
                .untilAsserted(() -> {
                    List<JsonNode> l = eventos(query);
                    ultimo.set(0, l);
                    assertThat(condicion.test(l)).as("eventos de '%s': %s", query, l).isTrue();
                });
        return ultimo.get(0);
    }

    protected static Predicate<List<JsonNode>> contieneAcciones(String... acciones) {
        return l -> nombres(JSON.valueToTree(l), "accion").containsAll(Arrays.asList(acciones));
    }

    protected static JsonNode unoConAccion(List<JsonNode> l, String accion) {
        return l.stream().filter(e -> accion.equals(e.path("accion").asString())).findFirst()
                .orElseThrow(() -> new AssertionError("Sin evento " + accion + " en " + l));
    }
}
