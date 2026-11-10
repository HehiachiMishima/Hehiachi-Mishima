package oracle.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import oracle.auditoria.AccionAuditoria;
import oracle.auditoria.ContextoAuditoria;
import oracle.auditoria.Detalle;
import oracle.auditoria.EntidadAuditoria;
import oracle.auditoria.RegistroAuditoria;
import oracle.auditoria.ResultadoAuditoria;
import oracle.common.exception.LimiteExcedidoException;
import oracle.common.exception.NoAutorizadoException;
import oracle.common.exception.PeticionInvalidaException;
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

/**
 * Acceso: login, renovacion (refresh), logout, sesion vigente y cambio de la
 * propia contrasena. El access token (JWT corto) viaja en la respuesta; el
 * refresh token, solo en una cookie HttpOnly (CookieRefresh).
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final LoginRateLimiter rateLimiter;
    private final RegistroAuditoria auditoria;
    private final SesionesRefresh sesiones;
    private final CookieRefresh cookie;

    public AuthController(AuthService authService, LoginRateLimiter rateLimiter, RegistroAuditoria auditoria,
            SesionesRefresh sesiones, CookieRefresh cookie) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.auditoria = auditoria;
        this.sesiones = sesiones;
        this.cookie = cookie;
    }

    @PostMapping("/login")
    @PreAuthorize("permitAll()")
    public ApiResponse<AuthResponse> login(
            @Valid @RequestBody LoginRequest peticion,
            HttpServletRequest http,
            HttpServletResponse respuesta) {
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
        ApiResponse<AuthResponse> r = authService.login(peticion, claveUsuario, claveIp);
        cookie.escribir(respuesta, sesiones.abrir(r.datos().usuario().id(), ip, http.getHeader("User-Agent")));
        return r;
    }

    /**
     * Renueva el access token con el refresh token de la cookie (rotandolo).
     * No pide contrasena. Exige X-Requested-With: una cabecera propia obliga al
     * preflight CORS, asi que otro sitio no puede disparar la renovacion.
     */
    @PostMapping("/refresh")
    @PreAuthorize("permitAll()")
    public ApiResponse<AuthResponse> refresh(HttpServletRequest http, HttpServletResponse respuesta) {
        exigirCabeceraAjax(http);
        SesionesRefresh.Rotacion rot = sesiones.rotar(cookie.leer(http), http.getRemoteAddr(),
                http.getHeader("User-Agent"));
        if (!rot.ok()) {
            cookie.borrar(respuesta);
            if (rot.reuso()) {
                auditoria.registrar(ContextoAuditoria.actual().conActor(rot.usuarioId(), null),
                        AccionAuditoria.SESION_REUTILIZADA, EntidadAuditoria.SESION, rot.usuarioId(),
                        ResultadoAuditoria.DENEGADO, Detalle.motivo("refresh_token_reutilizado"));
            }
            throw new NoAutorizadoException(AuthService.SESION_VENCIDA);
        }
        AuthResponse datos;
        try {
            datos = authService.renovar(rot.usuarioId());
        } catch (NoAutorizadoException ex) {
            cookie.borrar(respuesta);
            throw ex;
        }
        cookie.escribir(respuesta, rot.emitido());
        return ApiResponse.ok("Sesión renovada.", datos);
    }

    /** Cierra la sesion: revoca la familia del refresh token y borra la cookie. Idempotente. */
    @PostMapping("/logout")
    @PreAuthorize("permitAll()")
    public ApiResponse<Void> logout(HttpServletRequest http, HttpServletResponse respuesta) {
        exigirCabeceraAjax(http);
        Long usuarioId = sesiones.cerrar(cookie.leer(http));
        cookie.borrar(respuesta);
        if (usuarioId != null) {
            auditoria.exito(ContextoAuditoria.actual().conActor(usuarioId, null), AccionAuditoria.LOGOUT,
                    EntidadAuditoria.SESION, usuarioId, null);
        }
        return ApiResponse.<Void>ok("Sesión cerrada.", null);
    }

    private static void exigirCabeceraAjax(HttpServletRequest http) {
        if (!"XMLHttpRequest".equals(http.getHeader("X-Requested-With"))) {
            throw new PeticionInvalidaException("Falta la cabecera X-Requested-With.");
        }
    }

    /** Sesion vigente (usuario + permisos actuales) del portador del token. */
    @GetMapping("/sesion")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<SesionResponse> sesion() {
        return authService.sesionActual(ActorActual.id());
    }

    /**
     * Cambio de la propia contrasena: exige la actual. Revoca los tokens
     * anteriores y devuelve uno nuevo en datos (token, expiraEn...).
     */
    @PutMapping("/contrasena")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<AuthResponse> cambiarContrasena(@Valid @RequestBody CambiarContrasenaRequest peticion,
            HttpServletRequest http, HttpServletResponse respuesta) {
        Long actor = ActorActual.id();
        ApiResponse<AuthResponse> r = authService.cambiarContrasena(actor, peticion);
        // El cambio (ya confirmado) revoco todas las familias por trigger: esta sesion abre una nueva.
        cookie.escribir(respuesta, sesiones.abrir(actor, http.getRemoteAddr(), http.getHeader("User-Agent")));
        return r;
    }
}
