package oracle.auditoria;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Mantiene creadas por adelantado las particiones mensuales de
 * auditoria_eventos (funcion app.asegurar_particiones_bitacora, migracion V3).
 * Corre al arrancar y cada dia a las 03:17; es idempotente y barata (solo
 * consulta el catalogo si las particiones ya existen). Si fallara, los eventos
 * caen en la particion DEFAULT y no se pierde nada.
 */
@Configuration
@EnableScheduling
public class ParticionesBitacora {

    private static final Logger log = LoggerFactory.getLogger(ParticionesBitacora.class);

    private final JdbcTemplate jdbc;
    private final int mesesAdelante;

    public ParticionesBitacora(JdbcTemplate jdbc,
            @Value("${app.auditoria.particiones-adelante:3}") int mesesAdelante) {
        this.jdbc = jdbc;
        this.mesesAdelante = mesesAdelante;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void alArrancar() {
        asegurar();
    }

    @Scheduled(cron = "${app.auditoria.particiones-cron:0 17 3 * * *}")
    public void asegurar() {
        try {
            Integer creadas = jdbc.queryForObject("SELECT asegurar_particiones_bitacora(?)", Integer.class,
                    mesesAdelante);
            if (creadas != null && creadas > 0) {
                log.info("Bitacora: {} particion(es) mensual(es) nueva(s).", creadas);
            }
        } catch (RuntimeException ex) {
            log.error("No se pudieron asegurar las particiones de la bitacora: {}", ex.getMessage());
        }
    }
}
