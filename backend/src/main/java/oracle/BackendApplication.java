package oracle;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

	/**
	 * Zona de la JVM. Se mantiene America/Lima por compatibilidad: las respuestas
	 * existentes serializan LocalDateTime SIN zona (creadoEn, actualizadoEn,
	 * timestamp) y el frontend las muestra como hora local. La BD guarda UTC en
	 * cualquier caso (hibernate.jdbc.time_zone=UTC y serverTimezone=UTC), y la
	 * bitacora usa Instant (ISO con 'Z'). Cambiable con APP_ZONA_HORARIA (p. ej.
	 * UTC) cuando el contrato pase a fechas con zona.
	 */
	private static final String ZONA_POR_DEFECTO = "America/Lima";

	public static void main(String[] args) {
		String zona = System.getenv().getOrDefault("APP_ZONA_HORARIA", ZONA_POR_DEFECTO);
		TimeZone.setDefault(TimeZone.getTimeZone(zona));
		SpringApplication.run(BackendApplication.class, args);
	}

}
