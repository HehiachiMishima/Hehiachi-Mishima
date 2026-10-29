package oracle;

import static org.assertj.core.api.Assertions.assertThat;

import oracle.soporte.ApiPrueba;
import org.junit.jupiter.api.Test;

/**
 * El contexto completo arranca contra el MySQL efimero (Testcontainers) con
 * schema.sql + protection.admin.sql, y el usuario semilla queda creado.
 */
class BackendApplicationTests extends ApiPrueba {

	@Test
	void contextLoads() {
		assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM usuarios WHERE usuario = ?", Integer.class, ADMIN))
				.isEqualTo(1);
		esperarStatus(get("/api/health", null), 204);
	}

}
