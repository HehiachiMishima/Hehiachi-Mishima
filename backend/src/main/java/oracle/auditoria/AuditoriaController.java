package oracle.auditoria;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

import oracle.common.response.ApiResponse;
import oracle.common.response.PaginaResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/** Bitacora de auditoria: consulta, detalle, catalogo y exportacion CSV. */
@RestController
@RequestMapping("/api/auditoria")
@PreAuthorize("hasAuthority('VER_AUDITORIA')")
public class AuditoriaController {

    private static final DateTimeFormatter SELLO = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final AuditoriaService service;

    public AuditoriaController(AuditoriaService service) {
        this.service = service;
    }

    @GetMapping
    public Mono<ApiResponse<PaginaResponse<AuditoriaEventoResponse>>> listar(
            @ModelAttribute AuditoriaFiltroRequest filtro) {
        return service.listar(filtro);
    }

    @GetMapping("/catalogo")
    public Mono<ApiResponse<CatalogoAuditoriaResponse>> catalogo() {
        return service.catalogo();
    }

    /**
     * CSV en streaming (text/csv, adjunto, max. 50 000 filas). Se escribe en el
     * hilo de la peticion (hilos virtuales): sin timeout async y con memoria
     * constante. Los filtros se validan antes de abrir la respuesta.
     */
    @GetMapping("/exportar")
    public void exportar(@ModelAttribute AuditoriaFiltroRequest filtro, HttpServletResponse respuesta)
            throws IOException {
        FiltroAuditoria valido = service.validarExportacion(filtro);
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        String nombre = "auditoria-" + LocalDateTime.now(ZoneOffset.UTC).format(SELLO) + ".csv";
        respuesta.setContentType("text/csv;charset=UTF-8");
        respuesta.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + nombre + "\"");
        respuesta.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        service.exportar(valido, ctx, respuesta.getOutputStream());
    }

    @GetMapping("/{id}")
    public Mono<ApiResponse<AuditoriaEventoResponse>> obtener(@PathVariable Long id) {
        return service.obtener(id);
    }
}
