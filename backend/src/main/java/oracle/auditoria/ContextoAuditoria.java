package oracle.auditoria;

import jakarta.servlet.http.HttpServletRequest;
import oracle.common.config.RegistroPeticiones;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Quien, desde donde y con que id de correlacion. Se captura en el HILO DE LA
 * PETICION (SecurityContext y RequestContextHolder son thread-local), antes del
 * subscribeOn, y viaja al hilo de trabajo como valor inmutable.
 *
 * @param actorId null = anonimo (login), 0 = sistema
 */
public record ContextoAuditoria(Long actorId, String actorUsuario, String ip, String userAgent, String idCorrelacion) {

    /** Contexto de la peticion en curso (valores null si no hay peticion o no hay autenticacion). */
    public static ContextoAuditoria actual() {
        Long actorId = null;
        String actorUsuario = null;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            try {
                actorId = Long.valueOf(jwt.getSubject());
            } catch (NumberFormatException ignorado) {
                actorId = null;
            }
            actorUsuario = jwt.getClaimAsString("usuario");
        }

        String ip = null;
        String userAgent = null;
        String correlacion = MDC.get(RegistroPeticiones.MDC_CORRELACION);
        RequestAttributes atributos = RequestContextHolder.getRequestAttributes();
        if (atributos instanceof ServletRequestAttributes servlet) {
            HttpServletRequest peticion = servlet.getRequest();
            ip = peticion.getRemoteAddr();
            userAgent = peticion.getHeader("User-Agent");
            if (peticion.getAttribute(RegistroPeticiones.ATRIBUTO_CORRELACION) instanceof String id) {
                correlacion = id;
            }
        }
        return new ContextoAuditoria(actorId, actorUsuario, ip, userAgent, correlacion);
    }

    /** Mismo origen con otro actor (p. ej. el usuario que acaba de autenticarse). */
    public ContextoAuditoria conActor(Long id, String usuario) {
        return new ContextoAuditoria(id, usuario, ip, userAgent, idCorrelacion);
    }
}
