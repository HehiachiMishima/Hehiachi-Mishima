package oracle.controllers;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import oracle.request.LoginRequest;
import oracle.response.ApiResponse;
import oracle.response.AuthResponse;
import oracle.security.LoginRateLimiter;
import oracle.services.AuthService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

/** Acceso: unico endpoint publico de la API. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final LoginRateLimiter rateLimiter;

    public AuthController(AuthService authService, LoginRateLimiter rateLimiter) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/login")
    @PreAuthorize("permitAll()")
    public Mono<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest peticion,
            HttpServletRequest http) {
        String ip = http.getRemoteAddr();
        rateLimiter.verificar(ip);
        return authService.login(peticion, ip);
    }
}
