package oracle.monitoreo;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Deja el actor autenticado como atributo de la peticion. El filtro de acceso
 * (RegistroPeticiones) corre FUERA de la cadena de Spring Security, que limpia
 * el SecurityContext al terminar: sin este atributo no sabria quien llamo.
 */
public class InterceptorActor implements HandlerInterceptor {

    public static final String ATRIBUTO_ACTOR = InterceptorActor.class.getName() + ".actor";

    /** Actor de la peticion (id del sub del JWT y su claim "usuario"). */
    public record Actor(Long id, String usuario) {
    }

    @Override
    public boolean preHandle(HttpServletRequest peticion, HttpServletResponse respuesta, Object handler) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            Long id;
            try {
                id = Long.valueOf(jwt.getSubject());
            } catch (NumberFormatException ex) {
                id = null;
            }
            peticion.setAttribute(ATRIBUTO_ACTOR, new Actor(id, jwt.getClaimAsString("usuario")));
        }
        return true;
    }
}
