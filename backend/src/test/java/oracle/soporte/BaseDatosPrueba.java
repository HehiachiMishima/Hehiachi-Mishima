package oracle.soporte;

import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * PostgreSQL 17 efimero compartido por TODA la suite (un solo contenedor por
 * JVM; Ryuk lo elimina al terminar).
 *
 * El esquema NO se precarga: lo crea Flyway al arrancar el contexto con las
 * mismas migraciones (src/main/resources/db/migration) que produccion, asi que
 * la suite valida tambien las migraciones.
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
        c.withEnv("TZ", "UTC")
                .withCommand("postgres", "-c", "max_connections=300", "-c", "fsync=off",
                        "-c", "synchronous_commit=off");
        c.start();
        return c;
    }

    public static String jdbcUrl() {
        return "jdbc:postgresql://" + POSTGRES.getHost() + ":" + POSTGRES.getMappedPort(5432) + "/" + NOMBRE_BD
                + "?currentSchema=app,public&reWriteBatchedInserts=true";
    }

    public static String usuario() {
        return USUARIO;
    }

    public static String contrasena() {
        return CONTRASENA;
    }
}
