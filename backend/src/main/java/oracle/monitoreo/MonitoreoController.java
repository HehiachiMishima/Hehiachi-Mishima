package oracle.monitoreo;

import java.util.List;
import oracle.common.response.ApiResponse;
import oracle.common.response.PaginaResponse;
import oracle.monitoreo.Respuestas.ActividadUsuario;
import oracle.monitoreo.Respuestas.Incidencias;
import oracle.monitoreo.Respuestas.Peticion;
import oracle.monitoreo.Respuestas.Presencia;
import oracle.monitoreo.Respuestas.Punto;
import oracle.monitoreo.Respuestas.Resumen;
import oracle.monitoreo.Respuestas.Ruta;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Monitoreo administrativo: salud, trafico, incidencias, presencia y traza por usuario. */
@RestController
@RequestMapping("/api/monitoreo")
@PreAuthorize("hasAuthority('VER_MONITOREO')")
public class MonitoreoController {

    private final MonitoreoService service;

    public MonitoreoController(MonitoreoService service) {
        this.service = service;
    }

    /** Semaforo, JVM, BD, colas y KPIs de la ventana (minutos 1..60, por defecto 15). */
    @GetMapping("/resumen")
    public ApiResponse<Resumen> resumen(@RequestParam(required = false) Integer minutos) {
        return service.resumen(minutos);
    }

    @GetMapping("/serie")
    public ApiResponse<List<Punto>> serie(@RequestParam(required = false) Integer minutos) {
        return service.serie(minutos);
    }

    @GetMapping("/rutas")
    public ApiResponse<List<Ruta>> rutas(@RequestParam(required = false) Integer minutos) {
        return service.rutas(minutos);
    }

    @GetMapping("/incidencias")
    public ApiResponse<Incidencias> incidencias() {
        return service.incidencias();
    }

    @GetMapping("/usuarios-activos")
    public ApiResponse<List<Presencia>> usuariosActivos(@RequestParam(required = false) Integer minutos) {
        return service.presentes(minutos);
    }

    /** Traza persistida (bitacora.peticiones), paginada; por defecto ultimos 7 dias. */
    @GetMapping("/peticiones")
    public ApiResponse<PaginaResponse<Peticion>> peticiones(@ModelAttribute FiltroPeticiones filtro) {
        return service.peticiones(filtro);
    }

    @GetMapping("/usuarios/{id}/actividad")
    public ApiResponse<ActividadUsuario> actividad(@PathVariable Long id,
            @RequestParam(required = false) Integer dias,
            @RequestParam(required = false) String zona) {
        return service.actividad(id, dias, zona);
    }
}
