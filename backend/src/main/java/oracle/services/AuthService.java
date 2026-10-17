package oracle.services;

import java.util.List;
import oracle.exception.NoAutorizadoException;
import oracle.jwt.JwtService;
import oracle.model.Usuario;
import oracle.repository.ResolucionRepository;
import oracle.repository.UsuarioRepository;
import oracle.request.LoginRequest;
import oracle.response.ApiResponse;
import oracle.response.AuthResponse;
import oracle.response.UsuarioResponse;
import oracle.security.LoginRateLimiter;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/** Autenticacion: valida credenciales, respeta el kill switch y emite JWT. */
@Slf4j
@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final ResolucionRepository resolucionRepository;
    private final JwtService jwtService;
    private final LoginRateLimiter rateLimiter;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AuthService(
            UsuarioRepository usuarioRepository,
            ResolucionRepository resolucionRepository,
            JwtService jwtService,
            LoginRateLimiter rateLimiter) {
        this.usuarioRepository = usuarioRepository;
        this.resolucionRepository = resolucionRepository;
        this.jwtService = jwtService;
        this.rateLimiter = rateLimiter;
    }

    public Mono<ApiResponse<AuthResponse>> login(LoginRequest peticion, String ip) {
        return Mono.fromCallable(() -> Trazas.medir(log, "AuthService.login usuario=" + peticion.usuario(),
                        () -> autenticar(peticion)))
                .subscribeOn(Schedulers.boundedElastic())
                .map(respuesta -> {
                    rateLimiter.limpiar(ip);
                    return ApiResponse.ok("Autenticacion exitosa.", respuesta);
                })
                .onErrorResume(NoAutorizadoException.class, ex -> {
                    rateLimiter.registrarFallo(ip);
                    return Mono.error(ex);
                });
    }

    private AuthResponse autenticar(LoginRequest peticion) {
        String credencial = peticion.usuario().trim();
        Usuario usuario = usuarioRepository.findByUsuarioOrEmail(credencial, credencial)
                .orElseThrow(() -> new NoAutorizadoException("Usuario o contrasena incorrectos."));

        if (!passwordEncoder.matches(peticion.contrasena(), usuario.getContrasena())) {
            throw new NoAutorizadoException("Usuario o contrasena incorrectos.");
        }
        if (!Boolean.TRUE.equals(usuario.getActivo())) {
            throw new NoAutorizadoException("La cuenta esta desactivada.");
        }

        List<String> permisos = resolucionRepository.nombresPermitidos(usuario.getId());
        JwtService.TokenGenerado token = jwtService.generar(usuario);

        return new AuthResponse(token.valor(), "Bearer", token.expiraEn(), UsuarioResponse.of(usuario), permisos);
    }
}
