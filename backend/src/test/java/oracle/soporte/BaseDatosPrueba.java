package oracle.soporte;

import java.nio.file.Files;
import java.nio.file.Path;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.utility.MountableFile;

/**
 * MySQL 8.4 efimero compartido por TODA la suite (un solo contenedor por JVM;
 * Ryuk lo elimina al terminar).
 *
 * El esquema se carga con el propio entrypoint de la imagen oficial
 * (/docker-entrypoint-initdb.d), que usa el cliente mysql: asi se respetan los
 * DELIMITER $$ de schema.sql, que ScriptUtils de Testcontainers no soporta.
 * Orden: 1-schema.sql y despues 2-protection.admin.sql (con la BD
 * seleccionada por MYSQL_DATABASE), igual que el workflow de CI.
 */
public final class BaseDatosPrueba {

    public static final String NOMBRE_BD = "hehiachi_mishima";
    public static final String CONTRASENA_ROOT = "pruebas-root";

    private static final MySQLContainer MYSQL = crear();

    private BaseDatosPrueba() {
    }

    private static MySQLContainer crear() {
        Path base = directorioBackend();
        MySQLContainer c = new MySQLContainer("mysql:8.4")
                .withDatabaseName(NOMBRE_BD)
                .withUsername("root")
                .withPassword(CONTRASENA_ROOT);
        c.withEnv("TZ", "UTC")
                .withCopyFileToContainer(MountableFile.forHostPath(base.resolve("schema.sql")),
                        "/docker-entrypoint-initdb.d/1-schema.sql")
                .withCopyFileToContainer(MountableFile.forHostPath(base.resolve("protection.admin.sql")),
                        "/docker-entrypoint-initdb.d/2-protection.admin.sql")
                .withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_unicode_ci",
                        "--max-connections=500");
        c.start();
        return c;
    }

    /** Directorio backend/ (Maven fija basedir; si no, el directorio actual). */
    private static Path directorioBackend() {
        Path p = Path.of(System.getProperty("basedir", ".")).toAbsolutePath().normalize();
        if (Files.isRegularFile(p.resolve("schema.sql"))) {
            return p;
        }
        Path hijo = p.resolve("backend");
        if (Files.isRegularFile(hijo.resolve("schema.sql"))) {
            return hijo;
        }
        throw new IllegalStateException("No se encuentra backend/schema.sql desde " + p);
    }

    public static String jdbcUrl() {
        return "jdbc:mysql://" + MYSQL.getHost() + ":" + MYSQL.getMappedPort(3306) + "/" + NOMBRE_BD
                + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
    }

    public static String usuario() {
        return "root";
    }

    public static String contrasena() {
        return CONTRASENA_ROOT;
    }
}
