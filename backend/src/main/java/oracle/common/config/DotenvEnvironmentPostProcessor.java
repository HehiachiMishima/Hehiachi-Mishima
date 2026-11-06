package oracle.common.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Carga el archivo .env como pares CLAVE=VALOR crudos, sin el escapado ni el
 * recorte de comentarios del formato .properties (que corrompe contrasenas con
 * # $ o comillas). Los valores se agregan con la MENOR precedencia, asi que
 * argumentos de linea de comandos y variables de entorno siempre ganan.
 *
 * Ademas resuelve la conexion activa: DB_CONEXION=NUBE copia DB_NUBE_HOST,
 * DB_NUBE_PORT... a DB_HOST, DB_PORT... (con la menor precedencia, de modo
 * que un DB_HOST explicito sigue mandando). Asi se conmuta de base de datos
 * cambiando una sola linea.
 */
public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    private static final Logger log = LoggerFactory.getLogger(DotenvEnvironmentPostProcessor.class);

    private static final String ARCHIVO = ".env";
    private static final String NOMBRE_FUENTE = "dotenv";
    private static final String FUENTE_CONEXION = "db-conexion";
    private static final String[] CLAVES_CONEXION = {
        "HOST", "PORT", "NAME", "USER", "PASSWORD", "SSLMODE", "POOL", "STATEMENT_TIMEOUT_MS"
    };

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        cargarDotenv(environment);
        resolverConexion(environment);
    }

    /**
     * DB_CONEXION=X -> DB_HOST=DB_X_HOST, etc. (solo las claves definidas).
     * Si el bloque trae DB_X_URL=postgresql://usuario:clave@host:5432/base?sslmode=...
     * se descompone primero; las claves sueltas del bloque tienen prioridad.
     */
    private void resolverConexion(ConfigurableEnvironment environment) {
        String conexion = environment.getProperty("DB_CONEXION");
        if (conexion == null || conexion.isBlank()) {
            return;
        }
        String prefijo = "DB_" + conexion.strip().toUpperCase(java.util.Locale.ROOT) + "_";
        Map<String, Object> valores = new LinkedHashMap<>();
        String url = environment.getProperty(prefijo + "URL");
        if (url != null && !url.isBlank()) {
            descomponerUrl(url.strip(), valores);
        }
        for (String clave : CLAVES_CONEXION) {
            String valor = environment.getProperty(prefijo + clave);
            if (valor != null) {
                valores.put("DB_" + clave, valor);
            }
        }
        if (valores.isEmpty()) {
            log.warn("DB_CONEXION={} no tiene ninguna variable {}*", conexion, prefijo);
            return;
        }
        environment.getPropertySources().addLast(new MapPropertySource(FUENTE_CONEXION, valores));
    }

    /** postgres(ql)://usuario:clave@host:puerto/base?sslmode=x (formato de Render/Neon/Supabase). */
    private static void descomponerUrl(String url, Map<String, Object> valores) {
        try {
            java.net.URI uri = java.net.URI.create(url.replaceFirst("^postgres(ql)?://", "http://"));
            if (uri.getHost() != null) {
                valores.put("DB_HOST", uri.getHost());
            }
            if (uri.getPort() > 0) {
                valores.put("DB_PORT", String.valueOf(uri.getPort()));
            }
            if (uri.getPath() != null && uri.getPath().length() > 1) {
                valores.put("DB_NAME", uri.getPath().substring(1));
            }
            String info = uri.getRawUserInfo();
            if (info != null) {
                int dos = info.indexOf(':');
                valores.put("DB_USER", decodificar(dos < 0 ? info : info.substring(0, dos)));
                if (dos >= 0) {
                    valores.put("DB_PASSWORD", decodificar(info.substring(dos + 1)));
                }
            }
            String query = uri.getRawQuery();
            if (query != null) {
                for (String par : query.split("&")) {
                    if (par.startsWith("sslmode=")) {
                        valores.put("DB_SSLMODE", decodificar(par.substring("sslmode=".length())));
                    }
                }
            }
        } catch (IllegalArgumentException ex) {
            log.warn("La URL de base de datos del bloque activo no es valida; se ignora.");
        }
    }

    private static String decodificar(String v) {
        return java.net.URLDecoder.decode(v, StandardCharsets.UTF_8);
    }

    private void cargarDotenv(ConfigurableEnvironment environment) {
        Path ruta = Path.of(ARCHIVO);
        if (!Files.isRegularFile(ruta)) {
            return;
        }

        Map<String, Object> valores = new LinkedHashMap<>();
        try {
            for (String linea : Files.readAllLines(ruta, StandardCharsets.UTF_8)) {
                String limpia = linea.strip();
                if (limpia.isEmpty() || limpia.startsWith("#")) {
                    continue;
                }
                if (limpia.startsWith("export ")) {
                    limpia = limpia.substring("export ".length()).strip();
                }
                int separador = limpia.indexOf('=');
                if (separador <= 0) {
                    continue;
                }
                String clave = limpia.substring(0, separador).strip();
                String valor = sinComillas(limpia.substring(separador + 1).strip());
                valores.put(clave, valor);
            }
        } catch (IOException ex) {
            log.warn("No se pudo leer {}: {}", ARCHIVO, ex.getMessage());
            return;
        }

        if (!valores.isEmpty()) {
            environment.getPropertySources().addLast(new MapPropertySource(NOMBRE_FUENTE, valores));
            log.debug("Se cargaron {} claves desde {}", valores.size(), ARCHIVO);
        }
    }

    private String sinComillas(String valor) {
        if (valor.length() >= 2) {
            char primero = valor.charAt(0);
            char ultimo = valor.charAt(valor.length() - 1);
            if ((primero == '"' && ultimo == '"') || (primero == '\'' && ultimo == '\'')) {
                return valor.substring(1, valor.length() - 1);
            }
        }
        return valor;
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
