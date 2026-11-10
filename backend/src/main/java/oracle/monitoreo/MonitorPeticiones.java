package oracle.monitoreo;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import oracle.monitoreo.Respuestas.Peticion;
import oracle.monitoreo.Respuestas.Presencia;
import oracle.monitoreo.Respuestas.Punto;
import oracle.monitoreo.Respuestas.Ruta;
import oracle.monitoreo.Respuestas.Ventana;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Metricas de trafico en memoria (ultimos 60 min, por proceso): serie por
 * minuto, estadistica por endpoint, ultimas incidencias y presencia de
 * usuarios. Coste por peticion: un par de bloqueos de cubeta y un put en un
 * mapa; sin E/S. Con varias instancias, cada una ve su propio trafico; la
 * traza completa y global vive en bitacora.peticiones.
 */
@Component
public class MonitorPeticiones {

    /** Tope de endpoints distintos (defensa ante rutas inventadas por un atacante). */
    private static final int MAX_RUTAS = 400;
    private static final String OTRAS = "(otras rutas)";
    private static final int MAX_INCIDENCIAS = 100;
    private static final long PRESENCIA_MAX_MIN = 60;

    private final long umbralLentoMs;
    private final Instant iniciadoEn = Instant.now();
    private final AtomicInteger enVuelo = new AtomicInteger();
    private final SerieMinutos global = new SerieMinutos();
    private final Map<String, SerieMinutos> porRuta = new ConcurrentHashMap<>();
    private final Deque<PeticionRegistrada> errores = new ArrayDeque<>();
    private final Deque<PeticionRegistrada> lentas = new ArrayDeque<>();
    private final Map<Long, PresenciaMutable> presencia = new ConcurrentHashMap<>();

    public MonitorPeticiones(@Value("${app.monitoreo.umbral-lento-ms:1000}") long umbralLentoMs) {
        this.umbralLentoMs = umbralLentoMs;
    }

    public void entrar() {
        enVuelo.incrementAndGet();
    }

    public void salir() {
        enVuelo.decrementAndGet();
    }

    public void registrar(PeticionRegistrada p) {
        long minuto = p.ocurridoEn().getEpochSecond() / 60;
        global.registrar(minuto, p.estado(), p.duracionMs());
        serieDe(p.metodo() + " " + p.ruta()).registrar(minuto, p.estado(), p.duracionMs());
        if (p.esError()) {
            agregar(errores, p);
        }
        if (p.duracionMs() >= umbralLentoMs) {
            agregar(lentas, p);
        }
        if (p.actorId() != null) {
            presencia.computeIfAbsent(p.actorId(), id -> new PresenciaMutable(id, p.ocurridoEn())).ver(p);
        }
    }

    private SerieMinutos serieDe(String clave) {
        SerieMinutos s = porRuta.get(clave);
        if (s != null) {
            return s;
        }
        if (porRuta.size() >= MAX_RUTAS) {
            return porRuta.computeIfAbsent(OTRAS, k -> new SerieMinutos());
        }
        return porRuta.computeIfAbsent(clave, k -> new SerieMinutos());
    }

    private static void agregar(Deque<PeticionRegistrada> cola, PeticionRegistrada p) {
        synchronized (cola) {
            cola.addFirst(p);
            while (cola.size() > MAX_INCIDENCIAS) {
                cola.removeLast();
            }
        }
    }

    // ------------------------------------------------------------------ lecturas

    public Instant iniciadoEn() {
        return iniciadoEn;
    }

    public int enVuelo() {
        return Math.max(0, enVuelo.get());
    }

    public long umbralLentoMs() {
        return umbralLentoMs;
    }

    private static long minutoActual() {
        return Instant.now().getEpochSecond() / 60;
    }

    public Ventana ventana(int minutos) {
        long hasta = minutoActual();
        Agregado a = new Agregado();
        global.acumular(a, hasta - minutos, hasta);
        // El minuto en curso esta incompleto y el proceso pudo arrancar hace poco:
        // la tasa por minuto se calcula sobre el tiempo realmente cubierto.
        long ahora = Instant.now().getEpochSecond();
        double ventanaMin = (minutos - 1) + (ahora % 60) / 60.0;
        double uptimeMin = (ahora - iniciadoEn.getEpochSecond()) / 60.0;
        double transcurrido = Math.max(1.0 / 60, Math.min(ventanaMin, uptimeMin));
        return new Ventana(minutos, a.peticiones, redondear(a.peticiones / transcurrido), a.errores4xx,
                a.errores5xx, redondear(a.tasaError5xx() * 100), a.promedioMs(), a.percentil(0.50),
                a.percentil(0.95), a.percentil(0.99), a.maxMs);
    }

    public List<Punto> serie(int minutos) {
        long hasta = minutoActual();
        List<Punto> puntos = new ArrayList<>(minutos);
        for (long m = hasta - minutos + 1; m <= hasta; m++) {
            Agregado a = global.minuto(m);
            puntos.add(new Punto(Instant.ofEpochSecond(m * 60), a.peticiones, a.errores4xx, a.errores5xx,
                    a.promedioMs(), a.percentil(0.95), a.maxMs));
        }
        return puntos;
    }

    public List<Ruta> rutas(int minutos) {
        long hasta = minutoActual();
        List<Ruta> lista = new ArrayList<>();
        porRuta.forEach((clave, serie) -> {
            Agregado a = new Agregado();
            serie.acumular(a, hasta - minutos, hasta);
            if (a.peticiones == 0) {
                return;
            }
            int sep = clave.indexOf(' ');
            String metodo = sep > 0 ? clave.substring(0, sep) : "";
            String ruta = sep > 0 ? clave.substring(sep + 1) : clave;
            lista.add(new Ruta(metodo, ruta, a.peticiones, a.errores4xx, a.errores5xx, a.promedioMs(),
                    a.percentil(0.50), a.percentil(0.95), a.maxMs));
        });
        lista.sort(Comparator.comparingLong(Ruta::peticiones).reversed());
        return lista;
    }

    public List<Peticion> errores() {
        return copia(errores);
    }

    public List<Peticion> lentas() {
        return copia(lentas);
    }

    private static List<Peticion> copia(Deque<PeticionRegistrada> cola) {
        synchronized (cola) {
            return cola.stream().map(Peticion::de).toList();
        }
    }

    public List<Presencia> presentes(int minutos) {
        Instant limite = Instant.now().minusSeconds(minutos * 60L);
        return presencia.values().stream()
                .map(PresenciaMutable::foto)
                .filter(p -> p.ultimaVez().isAfter(limite))
                .sorted(Comparator.comparing(Presencia::ultimaVez).reversed())
                .toList();
    }

    /** Tras cerrar las sesiones de un usuario: deja de figurar como activo. */
    public void olvidar(Long actorId) {
        if (actorId != null) {
            presencia.remove(actorId);
        }
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    void purgarPresencia() {
        Instant limite = Instant.now().minusSeconds(PRESENCIA_MAX_MIN * 60);
        presencia.values().removeIf(p -> p.foto().ultimaVez().isBefore(limite));
    }

    private static double redondear(double v) {
        return Math.round(v * 100) / 100.0;
    }

    private static final class PresenciaMutable {
        private final Long id;
        private final Instant primeraVez;
        private String usuario;
        private Instant ultimaVez;
        private String ip;
        private String userAgent;
        private String ultimaRuta;
        private long peticiones;
        private long errores;

        PresenciaMutable(Long id, Instant primeraVez) {
            this.id = id;
            this.primeraVez = primeraVez;
            this.ultimaVez = primeraVez;
        }

        synchronized void ver(PeticionRegistrada p) {
            if (p.actorUsuario() != null) {
                usuario = p.actorUsuario();
            }
            if (!p.ocurridoEn().isBefore(ultimaVez)) {
                ultimaVez = p.ocurridoEn();
                ip = p.ip();
                userAgent = p.userAgent();
                ultimaRuta = p.metodo() + " " + p.ruta();
            }
            peticiones++;
            if (p.esError()) {
                errores++;
            }
        }

        synchronized Presencia foto() {
            return new Presencia(id, usuario, primeraVez, ultimaVez, ip, userAgent, ultimaRuta, peticiones, errores);
        }
    }
}
