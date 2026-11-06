package oracle.auth;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import oracle.admin.model.Usuario;
import oracle.admin.repository.ResolucionRepository;
import oracle.admin.repository.UsuarioRepository;
import oracle.admin.response.UsuarioResponse;
import oracle.admin.service.Protecciones;
import oracle.auditoria.AccionAuditoria;
import oracle.auditoria.ContextoAuditoria;
import oracle.auditoria.Detalle;
import oracle.auditoria.EntidadAuditoria;
import oracle.auditoria.RegistroAuditoria;
import oracle.auditoria.ResultadoAuditoria;
import oracle.common.config.Transacciones;
import oracle.common.exception.NoAutorizadoException;
import oracle.common.exception.OperacionNoPermitidaException;
import oracle.common.response.ApiResponse;
import oracle.common.security.AutorizacionCache;
import oracle.common.security.JwtService;
import oracle.common.security.LoginRateLimiter;
import oracle.common.support.Auditoria;
import oracle.common.support.Trazas;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Autenticacion: valida credenciales, aplica el bloqueo por cuenta, respeta el
 * kill switch y emite JWT. Nunca registra (ni en logs ni en la bitacora) la
 * credencial tecleada si no corresponde a una cuenta existente.
 */
@Slf4j
@Service
public class AuthService {

    /** Mensaje unico para no revelar si la cuenta existe, esta bloqueada o desactivada. */
    static final String CREDENCIALES_INVALIDAS = "Usuario o contraseña incorrectos.";

    private final UsuarioRepository usuarioRepository;
    private final ResolucionRepository resolucionRepository;
    private final JwtService jwtService;
    private final LoginRateLimiter rateLimiter;
    private final PasswordEncoder passwordEncoder;
    private final AutorizacionCache autorizacionCache;
    private final Transacciones transacciones;
    private final RegistroAuditoria auditoria;
    private final Protecciones protecciones;
    private final int umbralBloqueo;
    private final int maxMinutosBloqueo;
    private final SecretKeySpec claveHuella;

    /**
     * Hash descartable contra el que se compara cuando el usuario no existe,
     * para que el coste de BCrypt no delate la existencia de la cuenta.
     */
    private final String hashFicticio;

    public AuthService(
            UsuarioRepository usuarioRepository,
            ResolucionRepository resolucionRepository,
            JwtService jwtService,
            LoginRateLimiter rateLimiter,
            PasswordEncoder passwordEncoder,
            AutorizacionCache autorizacionCache,
            Transacciones transacciones,
            RegistroAuditoria auditoria,
            Protecciones protecciones,
            @Value("${app.seguridad.bloqueo.umbral:5}") int umbralBloqueo,
            @Value("${app.seguridad.bloqueo.max-minutos:60}") int maxMinutosBloqueo,
            @Value("${app.jwt.secret}") String secreto) {
        this.usuarioRepository = usuarioRepository;
        this.resolucionRepository = resolucionRepository;
        this.jwtService = jwtService;
        this.rateLimiter = rateLimiter;
        this.passwordEncoder = passwordEncoder;
        this.autorizacionCache = autorizacionCache;
        this.transacciones = transacciones;
        this.auditoria = auditoria;
        this.protecciones = protecciones;
        this.umbralBloqueo = umbralBloqueo;
        this.maxMinutosBloqueo = maxMinutosBloqueo;
        this.claveHuella = new SecretKeySpec(secreto.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        this.hashFicticio = passwordEncoder.encode("oracle-hash-ficticio-0");
    }

    /**
     * Login. El cupo del limitador ya se reservo en el controlador; aqui, si
     * es correcto, se limpia el cubo IP+usuario y se devuelve el intento al cubo IP.
     */
    public ApiResponse<AuthResponse> login(LoginRequest peticion, String claveUsuario, String claveIp) {
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        var respuesta = Trazas.medir(log, "AuthService.login", () -> autenticar(peticion, ctx));
        rateLimiter.limpiar(claveUsuario);
        rateLimiter.liberar(claveIp);
        return ApiResponse.ok("Inicio de sesión correcto.", respuesta);
    }

    /**
     * Sesion vigente del usuario autenticado. Usa la misma cache de autoridades
     * que el filtro JWT, asi que no agrega consultas en el caso comun y refleja
     * al instante los cambios de rol/permiso (que invalidan esa cache).
     */
    public ApiResponse<SesionResponse> sesionActual(Long usuarioId) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new NoAutorizadoException("Tu sesión ya no es válida."));
        if (!Boolean.TRUE.equals(usuario.getActivo())) {
            throw new NoAutorizadoException("Tu cuenta está desactivada.");
        }
        List<String> permisos = autorizacionCache.cargar(usuarioId).autoridades().stream()
                .map(a -> a.getAuthority())
                .toList();
        return ApiResponse.ok("Sesión vigente.",
                new SesionResponse(UsuarioResponse.of(usuario, true), permisos));
    }

    /**
     * Cambio de la propia contrasena. Exige la actual, sube la version de
     * credenciales (revoca TODOS los tokens anteriores, incluidos los robados) y
     * devuelve un token nuevo para que esta sesion continue.
     */
    public ApiResponse<AuthResponse> cambiarContrasena(Long usuarioId, CambiarContrasenaRequest peticion) {
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "AuthService.cambiarContrasena", () -> transacciones.ejecutar(() -> {
            Usuario usuario = usuarioRepository.findById(usuarioId)
                    .orElseThrow(() -> new NoAutorizadoException("Tu sesión ya no es válida."));
            if (!Boolean.TRUE.equals(usuario.getActivo())) {
                throw new NoAutorizadoException("Tu cuenta está desactivada.");
            }
            if (Protecciones.esUsuarioRaiz(usuario.getUsuario())) {
                throw new OperacionNoPermitidaException("La contraseña de " + Protecciones.USUARIO_RAIZ
                        + " está protegida en la base de datos y no se puede cambiar desde la aplicación.");
            }
            if (!passwordEncoder.matches(peticion.contrasenaActual(), usuario.getContrasena())) {
                auditoria.registrar(ctx, AccionAuditoria.CONTRASENA_CAMBIADA, EntidadAuditoria.USUARIO,
                        usuarioId, ResultadoAuditoria.FALLO, Detalle.motivo("contrasena_actual_incorrecta"));
                throw new NoAutorizadoException("Tu contraseña actual no es correcta.");
            }
            if (passwordEncoder.matches(peticion.contrasenaNueva(), usuario.getContrasena())) {
                throw new OperacionNoPermitidaException(
                        "La contraseña nueva debe ser distinta de la actual.");
            }
            usuario.setContrasena(passwordEncoder.encode(peticion.contrasenaNueva()));
            usuario.revocarCredenciales();
            Auditoria.alActualizar(usuario, usuarioId);
            usuarioRepository.save(usuario);
            autorizacionCache.invalidar(usuarioId);
            auditoria.exito(ctx, AccionAuditoria.CONTRASENA_CAMBIADA, EntidadAuditoria.USUARIO,
                    usuarioId, Detalle.de("origen", "propia"));
            return ApiResponse.ok("Contraseña actualizada.", emitir(usuario));
        }));
    }

    private AuthResponse autenticar(LoginRequest peticion, ContextoAuditoria ctx) {
        String credencial = peticion.usuario().trim();
        // Primero por usuario exacto y despues por email: nunca 2 filas (evita el 500 por cruce usuario/email).
        Optional<Usuario> encontrado = usuarioRepository.findByUsuario(credencial)
                .or(() -> usuarioRepository.findByEmail(credencial));

        if (encontrado.isPresent() && usuarioRepository.contarBloqueoVigente(encontrado.get().getId()) > 0) {
            Usuario u = encontrado.get();
            auditoria.registrar(ctx, AccionAuditoria.LOGIN_BLOQUEADO, EntidadAuditoria.SESION, u.getId(),
                    ResultadoAuditoria.DENEGADO, Detalle.motivo("cuenta_bloqueada"));
            throw new NoAutorizadoException(CREDENCIALES_INVALIDAS);
        }

        // Se ejecuta BCrypt SIEMPRE (contra un hash ficticio si el usuario no
        // existe) para no filtrar por tiempo la existencia de una cuenta.
        String hash = encontrado.map(Usuario::getContrasena).orElse(hashFicticio);
        boolean coincide = passwordEncoder.matches(peticion.contrasena(), hash);

        if (encontrado.isEmpty()) {
            // La credencial puede ser una contrasena tecleada en el campo equivocado:
            // solo se guarda una huella HMAC (correlaciona reintentos sin revelarla).
            auditoria.registrar(ctx, AccionAuditoria.LOGIN_FALLIDO, EntidadAuditoria.SESION, null,
                    ResultadoAuditoria.FALLO,
                    Detalle.de("motivo", "credencial_desconocida", "huella", huella(credencial)));
            throw new NoAutorizadoException(CREDENCIALES_INVALIDAS);
        }

        Usuario usuario = encontrado.get();
        ContextoAuditoria conUsuario = ctx.conActor(null, usuario.getUsuario());
        if (!coincide) {
            usuarioRepository.registrarFallo(usuario.getId(), umbralBloqueo, maxMinutosBloqueo);
            boolean bloqueada = usuarioRepository.contarBloqueoVigente(usuario.getId()) > 0;
            auditoria.registrar(conUsuario, AccionAuditoria.LOGIN_FALLIDO, EntidadAuditoria.SESION, usuario.getId(),
                    ResultadoAuditoria.FALLO,
                    Detalle.con(Detalle.motivo("contrasena_incorrecta"), "bloqueada", bloqueada ? Boolean.TRUE : null));
            throw new NoAutorizadoException(CREDENCIALES_INVALIDAS);
        }
        if (!Boolean.TRUE.equals(usuario.getActivo())) {
            // Mismo mensaje generico: no confirma que la contrasena era correcta.
            auditoria.registrar(conUsuario, AccionAuditoria.LOGIN_FALLIDO, EntidadAuditoria.SESION, usuario.getId(),
                    ResultadoAuditoria.FALLO, Detalle.motivo("cuenta_desactivada"));
            throw new NoAutorizadoException(CREDENCIALES_INVALIDAS);
        }

        usuarioRepository.reiniciarIntentos(usuario.getId());
        AuthResponse respuesta = emitir(usuario);
        auditoria.exito(ctx.conActor(usuario.getId(), usuario.getUsuario()), AccionAuditoria.LOGIN_EXITOSO,
                EntidadAuditoria.SESION, usuario.getId(), null);
        return respuesta;
    }

    private AuthResponse emitir(Usuario usuario) {
        List<String> permisos = resolucionRepository.nombresPermitidos(usuario.getId());
        JwtService.TokenGenerado token = jwtService.generar(usuario);
        return new AuthResponse(token.valor(), "Bearer", token.expiraEn(), UsuarioResponse.of(usuario, true), permisos);
    }

    /** HMAC-SHA256 truncado (12 hex) con el secreto de la app: no es reversible ni atacable por diccionario sin la clave. */
    private String huella(String credencial) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(claveHuella);
            byte[] h = mac.doFinal(credencial.toLowerCase(java.util.Locale.ROOT).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h, 0, 6);
        } catch (java.security.GeneralSecurityException ex) {
            return null;
        }
    }
}
