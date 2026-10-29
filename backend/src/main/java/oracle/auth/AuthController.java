package oracle.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import oracle.auditoria.AccionAuditoria;
import oracle.auditoria.ContextoAuditoria;
import oracle.auditoria.Detalle;
import oracle.auditoria.EntidadAuditoria;
import oracle.auditoria.RegistroAuditoria;
import oracle.auditoria.ResultadoAuditoria;
import oracle.common.exception.LimiteExcedidoException;
import oracle.common.response.ApiResponse;
import oracle.common.security.LoginRateLimiter;
import oracle.common.support.ActorActual;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/** Acceso: login (publico), sesion vigente y cambio de la propia contrasena. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final LoginRateLimiter rateLimiter;
    private final RegistroAuditoria auditoria;

    public AuthController(AuthService authService, LoginRateLimiter rateLimiter, RegistroAuditoria auditoria) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.auditoria = auditoria;
    }

    @PostMapping("/login")
    @PreAuthorize("permitAll()")
    public Mono<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest peticion,
            HttpServletRequest http) {
        // Doble cubo reservado ANTES de verificar (sin carrera): por IP (frena la
        // rotacion de usuarios) y por IP+usuario (no bloquea a toda una IP por un usuario).
        String ip = http.getRemoteAddr();
        String claveUsuario = LoginRateLimiter.claveUsuario(ip, peticion.usuario());
        String claveIp = LoginRateLimiter.claveIp(ip);
        try {
            rateLimiter.consumir(claveIp, LoginRateLimiter.MAX_INTENTOS_IP);
            try {
                rateLimiter.consumir(claveUsuario, LoginRateLimiter.MAX_INTENTOS_USUARIO);
            } catch (LimiteExcedidoException ex) {
                rateLimiter.liberar(claveIp);
                throw ex;
            }
        } catch (LimiteExcedidoException ex) {
            auditoria.registrar(ContextoAuditoria.actual(), AccionAuditoria.LOGIN_BLOQUEADO, EntidadAuditoria.SESION,
                    null, ResultadoAuditoria.DENEGADO, Detalle.motivo("limite_de_intentos"));
            throw ex;
        }
        return authService.login(peticion, claveUsuario, claveIp);
    }

    /** Sesion vigente (usuario + permisos actuales) del portador del token. */
    @GetMapping("/sesion")
    @PreAuthorize("isAuthenticated()")
    public Mono<ApiResponse<SesionResponse>> sesion() {
        return authService.sesionActual(ActorActual.id());
    }

    /**
     * Cambio de la propia contrasena: exige la actual. Revoca los tokens
     * anteriores y devuelve uno nuevo en datos (token, expiraEn...).
     */
    @PutMapping("/contrasena")
    @PreAuthorize("isAuthenticated()")
    public Mono<ApiResponse<AuthResponse>> cambiarContrasena(@Valid @RequestBody CambiarContrasenaRequest peticion) {
        return authService.cambiarContrasena(ActorActual.id(), peticion);
    }
}
