package oracle.common.security;

import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import oracle.auditoria.AccionAuditoria;
import oracle.auditoria.ContextoAuditoria;
import oracle.auditoria.Detalle;
import oracle.auditoria.RegistroAuditoria;
import oracle.auditoria.ResultadoAuditoria;
import oracle.common.exception.ApiError;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/**
 * Devuelve 403 en JSON cuando la cadena de filtros deniega el acceso y lo deja
 * en la bitacora (ACCESO_DENEGADO). Las denegaciones de @PreAuthorize las
 * registra GlobalExceptionHandler.
 */
@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;
    private final RegistroAuditoria auditoria;

    public RestAccessDeniedHandler(ObjectMapper objectMapper, RegistroAuditoria auditoria) {
        this.objectMapper = objectMapper;
        this.auditoria = auditoria;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException {
        auditoria.registrar(ContextoAuditoria.actual(), AccionAuditoria.ACCESO_DENEGADO, null, null,
                ResultadoAuditoria.DENEGADO,
                Detalle.de("motivo", "sin_permiso", "metodo", request.getMethod(), "ruta", request.getRequestURI()));
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        ApiError error = ApiError.de(403, "Acceso denegado",
                "No tienes el permiso necesario para esta operación.", request.getRequestURI());
        objectMapper.writeValue(response.getOutputStream(), error);
    }
}
