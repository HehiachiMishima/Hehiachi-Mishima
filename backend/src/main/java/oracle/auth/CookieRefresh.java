package oracle.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * Cookie del refresh token: HttpOnly (el JavaScript no la lee: un XSS no puede
 * robarla), SameSite=Strict (otro sitio no puede usarla), Secure en produccion
 * y Path=/api/auth (solo viaja a login, refresh, logout y contrasena; nunca al
 * resto de la API).
 */
@Component
public class CookieRefresh {

    public static final String NOMBRE = "rt";
    static final String RUTA = "/api/auth";

    private final boolean segura;
    private final String sameSite;

    public CookieRefresh(
            @Value("${app.refresh.cookie-secure:true}") boolean segura,
            @Value("${app.refresh.cookie-same-site:Strict}") String sameSite) {
        this.segura = segura;
        this.sameSite = sameSite;
    }

    public void escribir(HttpServletResponse respuesta, SesionesRefresh.Emitido emitido) {
        long segundos = Math.max(0, Duration.between(Instant.now(), emitido.familiaExpiraEn()).toSeconds());
        respuesta.addHeader(HttpHeaders.SET_COOKIE, base(emitido.token()).maxAge(segundos).build().toString());
        respuesta.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
    }

    public void borrar(HttpServletResponse respuesta) {
        respuesta.addHeader(HttpHeaders.SET_COOKIE, base("").maxAge(0).build().toString());
    }

    public String leer(HttpServletRequest peticion) {
        Cookie[] cookies = peticion.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie c : cookies) {
            if (NOMBRE.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                return c.getValue();
            }
        }
        return null;
    }

    private ResponseCookie.ResponseCookieBuilder base(String valor) {
        return ResponseCookie.from(NOMBRE, valor).httpOnly(true).secure(segura).sameSite(sameSite).path(RUTA);
    }
}
