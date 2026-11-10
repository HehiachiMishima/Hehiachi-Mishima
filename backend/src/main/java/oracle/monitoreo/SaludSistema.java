package oracle.monitoreo;

import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.ThreadMXBean;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import javax.sql.DataSource;
import oracle.monitoreo.Respuestas.BaseDatos;
import oracle.monitoreo.Respuestas.Colas;
import oracle.monitoreo.Respuestas.Jvm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Foto de la salud del proceso: JVM, pool de conexiones, latencia real de la
 * BD y colas de escritura asincrona. La BD se mide con un SELECT 1 con tope
 * de 2 s; la foto se cachea 5 s para que varios tableros abiertos no
 * multipliquen las consultas.
 */
@Component
class SaludSistema {

    private static final Logger log = LoggerFactory.getLogger(SaludSistema.class);
    private static final long CACHE_MS = 5_000;

    private final DataSource dataSource;
    private final MeterRegistry metricas;
    private final TrazaPeticiones trazas;

    private volatile BaseDatos ultimaBd;
    private volatile long ultimaBdEn;

    SaludSistema(DataSource dataSource, MeterRegistry metricas, TrazaPeticiones trazas) {
        this.dataSource = dataSource;
        this.metricas = metricas;
        this.trazas = trazas;
    }

    Jvm jvm() {
        MemoryMXBean memoria = ManagementFactory.getMemoryMXBean();
        ThreadMXBean hilos = ManagementFactory.getThreadMXBean();
        long gcConteo = 0;
        long gcTiempo = 0;
        for (GarbageCollectorMXBean gc : ManagementFactory.getGarbageCollectorMXBeans()) {
            gcConteo += Math.max(0, gc.getCollectionCount());
            gcTiempo += Math.max(0, gc.getCollectionTime());
        }
        double cpuProceso = -1;
        double cpuSistema = -1;
        if (ManagementFactory.getOperatingSystemMXBean() instanceof com.sun.management.OperatingSystemMXBean os) {
            cpuProceso = porcentaje(os.getProcessCpuLoad());
            cpuSistema = porcentaje(os.getCpuLoad());
        }
        long heapMax = memoria.getHeapMemoryUsage().getMax();
        return new Jvm(memoria.getHeapMemoryUsage().getUsed(), heapMax < 0 ? memoria.getHeapMemoryUsage().getCommitted() : heapMax,
                memoria.getNonHeapMemoryUsage().getUsed(), cpuProceso, cpuSistema,
                Runtime.getRuntime().availableProcessors(), hilos.getThreadCount(), hilos.getPeakThreadCount(),
                gcConteo, gcTiempo, Runtime.version().toString());
    }

    private static double porcentaje(double carga) {
        return carga < 0 ? -1 : Math.round(carga * 1000) / 10.0;
    }

    BaseDatos baseDatos() {
        long ahora = System.currentTimeMillis();
        BaseDatos cache = ultimaBd;
        if (cache != null && ahora - ultimaBdEn < CACHE_MS) {
            return conPool(cache);
        }
        BaseDatos medida = medirBd();
        ultimaBd = medida;
        ultimaBdEn = ahora;
        return conPool(medida);
    }

    private BaseDatos medirBd() {
        long inicio = System.nanoTime();
        try (Connection c = dataSource.getConnection(); Statement st = c.createStatement()) {
            st.setQueryTimeout(2);
            try (ResultSet rs = st.executeQuery("SELECT 1")) {
                rs.next();
            }
            long latencia = (System.nanoTime() - inicio) / 1_000_000L;
            Long tamano = null;
            Integer conexiones = null;
            try (ResultSet rs = st.executeQuery("""
                    SELECT pg_database_size(current_database()),
                           (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database())""")) {
                if (rs.next()) {
                    tamano = rs.getLong(1);
                    conexiones = rs.getInt(2);
                }
            } catch (Exception ex) {
                log.debug("Sin estadisticas de la BD: {}", ex.getMessage());
            }
            return new BaseDatos(true, latencia, null, null, null, null, null, tamano, conexiones);
        } catch (Exception ex) {
            log.warn("Monitoreo: la base de datos no responde: {}", ex.getMessage());
            return new BaseDatos(false, null, null, null, null, null, null, null, null);
        }
    }

    /** El pool se lee siempre en vivo (no consulta la BD). */
    private BaseDatos conPool(BaseDatos bd) {
        HikariPoolMXBean pool = null;
        Integer maximo = null;
        try {
            if (dataSource.isWrapperFor(HikariDataSource.class)) {
                HikariDataSource h = dataSource.unwrap(HikariDataSource.class);
                pool = h.getHikariPoolMXBean();
                maximo = h.getMaximumPoolSize();
            }
        } catch (Exception ex) {
            pool = null;
        }
        if (pool == null) {
            return bd;
        }
        return new BaseDatos(bd.disponible(), bd.latenciaMs(), pool.getActiveConnections(),
                pool.getIdleConnections(), pool.getTotalConnections(), pool.getThreadsAwaitingConnection(), maximo,
                bd.tamanoBytes(), bd.conexionesServidor());
    }

    Colas colas() {
        Gauge pendientes = metricas.find("auditoria.cola.tamano").gauge();
        Counter descartados = metricas.find("auditoria.eventos").tag("estado", "descartado").counter();
        Counter fallidos = metricas.find("auditoria.eventos").tag("estado", "fallido").counter();
        long perdidos = (long) ((descartados == null ? 0 : descartados.count()) + (fallidos == null ? 0 : fallidos.count()));
        return new Colas(pendientes == null ? 0 : (long) pendientes.value(), perdidos, trazas.pendientes(),
                trazas.descartadas(), trazas.persiste(), trazas.retencionDias());
    }
}
