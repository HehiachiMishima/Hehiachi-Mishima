package oracle.monitoreo;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import oracle.common.config.Transacciones;
import oracle.common.exception.PeticionInvalidaException;
import oracle.common.response.ApiResponse;
import oracle.common.response.PaginaResponse;
import oracle.common.support.CondicionSql;
import oracle.common.support.Trazas;
import oracle.monitoreo.Respuestas.ActividadUsuario;
import oracle.monitoreo.Respuestas.BaseDatos;
import oracle.monitoreo.Respuestas.Colas;
import oracle.monitoreo.Respuestas.Incidencias;
import oracle.monitoreo.Respuestas.Jvm;
import oracle.monitoreo.Respuestas.Peticion;
import oracle.monitoreo.Respuestas.Presencia;
import oracle.monitoreo.Respuestas.Punto;
import oracle.monitoreo.Respuestas.Resumen;
import oracle.monitoreo.Respuestas.Ruta;
import oracle.monitoreo.Respuestas.Sistema;
import oracle.monitoreo.Respuestas.Ventana;
import org.springframework.stereotype.Service;

/** Lectura del monitoreo: metricas en memoria + traza persistida. Solo lectura. */
@Slf4j
@Service
public class MonitoreoService {

    static final int TAMANO_MAXIMO = 100;
    static final int MAX_FILAS = 50_000;
    private static final int MIN_PETICIONES_ALERTA = 20;

    private final MonitorPeticiones monitor;
    private final SaludSistema salud;
    private final PeticionesRepository repositorio;
    private final Transacciones transacciones;

    public MonitoreoService(MonitorPeticiones monitor, SaludSistema salud, PeticionesRepository repositorio,
            Transacciones transacciones) {
        this.monitor = monitor;
        this.salud = salud;
        this.repositorio = repositorio;
        this.transacciones = transacciones;
    }

    public ApiResponse<Resumen> resumen(Integer minutos) {
        int m = minutos(minutos, 15);
        Ventana ventana = monitor.ventana(m);
        Ventana cinco = m == 5 ? ventana : monitor.ventana(5);
        Jvm jvm = salud.jvm();
        BaseDatos bd = salud.baseDatos();
        Colas colas = salud.colas();
        List<String> alertas = new ArrayList<>();
        String estado = evaluar(cinco, jvm, bd, colas, alertas);
        Instant ahora = Instant.now();
        Sistema sistema = new Sistema(estado, alertas, monitor.iniciadoEn(),
                Duration.between(monitor.iniciadoEn(), ahora).toSeconds(), monitor.enVuelo(), jvm, bd, colas);
        return ApiResponse.ok("Estado del sistema.",
                new Resumen(ahora, sistema, ventana, cinco, monitor.presentes(15).size()));
    }

    /** Reglas del semaforo; mismas que se documentan en la UI. */
    private String evaluar(Ventana v, Jvm jvm, BaseDatos bd, Colas colas, List<String> alertas) {
        if (!bd.disponible()) {
            alertas.add("La base de datos no responde.");
            return "CAIDO";
        }
        if (v.peticiones() >= MIN_PETICIONES_ALERTA && v.tasaError5xx() >= 5) {
            alertas.add("Errores del servidor (5xx) en el " + v.tasaError5xx() + " % de las peticiones de los últimos 5 min.");
        }
        if (v.peticiones() >= MIN_PETICIONES_ALERTA && v.p95Ms() >= monitor.umbralLentoMs()) {
            alertas.add("Latencia alta: p95 de " + v.p95Ms() + " ms en los últimos 5 min.");
        }
        if (bd.latenciaMs() != null && bd.latenciaMs() >= 500) {
            alertas.add("La base de datos tarda " + bd.latenciaMs() + " ms en responder.");
        }
        if (bd.poolEsperando() != null && bd.poolEsperando() > 0) {
            alertas.add(bd.poolEsperando() + " peticiones esperan una conexión libre del pool.");
        }
        if (jvm.heapMaxBytes() > 0 && (double) jvm.heapUsadoBytes() / jvm.heapMaxBytes() >= 0.9) {
            alertas.add("Memoria de la aplicación por encima del 90 %.");
        }
        if (colas.auditoriaDescartados() > 0) {
            alertas.add(colas.auditoriaDescartados() + " eventos de auditoría no se pudieron guardar desde el arranque.");
        }
        return alertas.isEmpty() ? "OPERATIVO" : "DEGRADADO";
    }

    public ApiResponse<List<Punto>> serie(Integer minutos) {
        return ApiResponse.ok("Serie por minuto.", monitor.serie(minutos(minutos, 60)));
    }

    public ApiResponse<List<Ruta>> rutas(Integer minutos) {
        return ApiResponse.ok("Peticiones por endpoint.", monitor.rutas(minutos(minutos, 60)));
    }

    public ApiResponse<Incidencias> incidencias() {
        return ApiResponse.ok("Incidencias recientes.",
                new Incidencias(monitor.umbralLentoMs(), monitor.errores(), monitor.lentas()));
    }

    public ApiResponse<List<Presencia>> presentes(Integer minutos) {
        return ApiResponse.ok("Usuarios activos.", monitor.presentes(minutos(minutos, 15)));
    }

    public ApiResponse<PaginaResponse<Peticion>> peticiones(FiltroPeticiones filtro) {
        int pagina = filtro.pagina() == null ? 1 : filtro.pagina();
        int tamano = filtro.tamano() == null ? 25 : filtro.tamano();
        if (pagina < 1 || tamano < 1 || tamano > TAMANO_MAXIMO) {
            throw new PeticionInvalidaException("La página empieza en 1 y el tamaño debe estar entre 1 y " + TAMANO_MAXIMO + ".");
        }
        long offset = (long) (pagina - 1) * tamano;
        if (offset >= MAX_FILAS) {
            throw new PeticionInvalidaException("Solo se pueden recorrer las primeras " + MAX_FILAS
                    + " peticiones. Acota el periodo o los filtros.");
        }
        CondicionSql condicion = filtro.condicion(Instant.now());
        var p = Trazas.medir(log, "MonitoreoService.peticiones", () -> transacciones.consultar(() -> {
            List<Peticion> contenido = repositorio.pagina(condicion, (int) offset, tamano);
            long total = repositorio.contar(condicion, MAX_FILAS);
            return PaginaResponse.of(contenido, total, pagina, tamano);
        }));
        return ApiResponse.ok("Traza de peticiones.", p);
    }

    public ApiResponse<ActividadUsuario> actividad(Long actorId, Integer dias) {
        int d = dias == null ? 7 : dias;
        if (d < 1 || d > 90) {
            throw new PeticionInvalidaException("Los días deben estar entre 1 y 90.");
        }
        Instant desde = Instant.now().minus(Duration.ofDays(d));
        var a = Trazas.medir(log, "MonitoreoService.actividad", () -> transacciones.consultar(() -> {
            var t = repositorio.totalesActor(actorId, desde);
            return new ActividadUsuario(actorId, d, t.peticiones(), t.errores(), t.primera(), t.ultima(),
                    repositorio.porDiaActor(actorId, desde), repositorio.rutasActor(actorId, desde),
                    repositorio.ipsActor(actorId, desde), repositorio.estadosActor(actorId, desde));
        }));
        return ApiResponse.ok("Actividad del usuario.", a);
    }

    private static int minutos(Integer valor, int porDefecto) {
        int m = valor == null ? porDefecto : valor;
        if (m < 1 || m > SerieMinutos.MINUTOS) {
            throw new PeticionInvalidaException("Los minutos deben estar entre 1 y " + SerieMinutos.MINUTOS + ".");
        }
        return m;
    }
}
