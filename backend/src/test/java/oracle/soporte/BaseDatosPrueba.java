package oracle.soporte;

import java.nio.file.Files;
import java.nio.file.Path;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

/**
 * PostgreSQL 17 efimero compartido por TODA la suite (un solo contenedor por
 * JVM; Ryuk lo elimina al terminar).
 *
 * El esquema se carga con el propio entrypoint de la imagen oficial
 * (/docker-entrypoint-initdb.d), que lo ejecuta con psql y ON_ERROR_STOP:
 * exactamente como se aplica backend/schema.sql a mano en cualquier entorno.
 */
public final class BaseDatosPrueba {

    public static final String NOMBRE_BD = "hehiachi_mishima";
    public static final String USUARIO = "app";
    public static final String CONTRASENA = "pruebas-app";

    private static final PostgreSQLContainer POSTGRES = crear();

    private BaseDatosPrueba() {
    }

    private static PostgreSQLContainer crear() {
        PostgreSQLContainer c = new PostgreSQLContainer("postgres:17-alpine")
                .withDatabaseName(NOMBRE_BD)
                .withUsername(USUARIO)
                .withPassword(CONTRASENA);
        c.withCopyFileToContainer(MountableFile.forHostPath(esquema()), "/docker-entrypoint-initdb.d/1-schema.sql")
                .withEnv("TZ", "UTC")
                .withCommand("postgres", "-c", "max_connections=300", "-c", "fsync=off",
                        "-c", "synchronous_commit=off");
        c.start();
        return c;
    }

    /** backend/schema.sql (Maven fija basedir; si no, el directorio actual). */
    private static Path esquema() {
        Path base = Path.of(System.getProperty("basedir", ".")).toAbsolutePath().normalize();
        for (Path candidato : new Path[] {base.resolve("schema.sql"), base.resolve("backend/schema.sql")}) {
            if (Files.isRegularFile(candidato)) {
                return candidato;
            }
        }
        throw new IllegalStateException("No se encuentra backend/schema.sql desde " + base);
    }

    public static String jdbcUrl() {
        return "jdbc:postgresql://" + POSTGRES.getHost() + ":" + POSTGRES.getMappedPort(5432) + "/" + NOMBRE_BD
                + "?currentSchema=seguridad,comun,bitacora,public&reWriteBatchedInserts=true";
    }

    public static String usuario() {
        return USUARIO;
    }

    public static String contrasena() {
        return CONTRASENA;
    }
}
