package oracle.common.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Convierte el JWT en un Authentication con las autoridades del usuario.
 *
 * Las autoridades se resuelven contra la vista final (deny-overrides) pero a
 * traves de AutorizacionCache, de modo que no se ejecutan 2 consultas SQL en
 * cada peticion. Un usuario inexistente o inactivo, o un token cuya version
 * de credenciales (claim "ver") ya no coincide, se rechaza con 401.
 */
@Component
public class PermisosJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final AutorizacionCache autorizacionCache;

    public PermisosJwtConverter(AutorizacionCache autorizacionCache) {
        this.autorizacionCache = autorizacionCache;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Long usuarioId = parsearId(jwt.getSubject());
        AutorizacionCache.Autorizacion autorizacion = autorizacionCache.cargar(usuarioId);
        if (!autorizacion.activo()) {
            throw new BadCredentialsException("La cuenta está desactivada.");
        }
        Object ver = jwt.getClaim(JwtService.CLAIM_VERSION);
        int versionToken = ver instanceof Number n ? n.intValue() : -1;
        if (versionToken != autorizacion.version()) {
            throw new BadCredentialsException("La sesión fue revocada.");
        }
        return new JwtAuthenticationToken(
                jwt, autorizacion.autoridades(), autorizacion.usuario());
    }

    private Long parsearId(String sub) {
        try {
            return Long.valueOf(sub);
        } catch (NumberFormatException ex) {
            throw new BadCredentialsException("Token inválido.");
        }
    }
}
