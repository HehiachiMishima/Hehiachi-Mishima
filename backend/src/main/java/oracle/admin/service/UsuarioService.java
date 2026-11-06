package oracle.admin.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import oracle.admin.model.Usuario;
import oracle.admin.repository.ResolucionRepository;
import oracle.admin.repository.UsuarioRepository;
import oracle.admin.request.CambiarEstadoRequest;
import oracle.admin.request.UsuarioActualizarRequest;
import oracle.admin.request.UsuarioCrearRequest;
import oracle.admin.request.UsuarioFiltroRequest;
import oracle.admin.response.UsuarioResponse;
import oracle.admin.response.UsuarioResumenResponse;
import oracle.auditoria.AccionAuditoria;
import oracle.auditoria.ContextoAuditoria;
import oracle.auditoria.Detalle;
import oracle.auditoria.EntidadAuditoria;
import oracle.auditoria.RegistroAuditoria;
import oracle.common.config.Transacciones;
import oracle.common.exception.ConflictoException;
import oracle.common.exception.OperacionNoPermitidaException;
import oracle.common.exception.PeticionInvalidaException;
import oracle.common.exception.RecursoNoEncontradoException;
import oracle.common.response.ApiResponse;
import oracle.common.security.AutorizacionCache;
import oracle.common.support.ActorActual;
import oracle.common.support.Auditoria;
import oracle.common.support.Filtros;
import oracle.common.support.Listas;
import oracle.common.support.Trazas;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * CRUD de usuarios con filtros LIKE. JPA es bloqueante, asi que toda
 * operacion se ejecuta en un hilo de boundedElastic. Cada cambio queda en la
 * bitacora y pasa por GuardiaPrivilegios (sin escalada ni autogestion).
 */
@Slf4j
@Service
public class UsuarioService {

    /** Usuarios por consulta del resumen (= ANY(?) que PostgreSQL empuja dentro de la vista). */
    private static final int LOTE_RESUMEN = 200;
    /** Maximo de ids explicitos aceptados en /usuarios/resumen?ids=. */
    public static final int MAX_IDS_RESUMEN = 500;
    private static final Sort ORDEN = Sort.by("id");

    private final UsuarioRepository usuarioRepository;
    private final AutorizacionCache autorizacionCache;
    private final PasswordEncoder passwordEncoder;
    private final Transacciones transacciones;
    private final ResolucionRepository resolucionRepository;
    private final Protecciones protecciones;
    private final GuardiaPrivilegios guardia;
    private final RegistroAuditoria auditoria;

    public UsuarioService(
            UsuarioRepository usuarioRepository,
            AutorizacionCache autorizacionCache,
            PasswordEncoder passwordEncoder,
            Transacciones transacciones,
            ResolucionRepository resolucionRepository,
            Protecciones protecciones,
            GuardiaPrivilegios guardia,
            RegistroAuditoria auditoria) {
        this.usuarioRepository = usuarioRepository;
        this.autorizacionCache = autorizacionCache;
        this.passwordEncoder = passwordEncoder;
        this.transacciones = transacciones;
        this.resolucionRepository = resolucionRepository;
        this.protecciones = protecciones;
        this.guardia = guardia;
        this.auditoria = auditoria;
    }

    public ApiResponse<List<UsuarioResponse>> listar() {
        Long actor = ActorActual.id();
        var resultado = Trazas.medir(log, "UsuarioService.listar", () -> {
            List<UsuarioResponse> lista = usuarioRepository.findAll(Listas.limitado(ORDEN)).stream()
                    .map(u -> respuesta(u, actor)).toList();
            Listas.avisarSiCorto(log, lista.size(), "UsuarioService.listar");
            return lista;
        });
        return ApiResponse.ok("Usuarios listados.", resultado);
    }

    public ApiResponse<List<UsuarioResponse>> buscar(UsuarioFiltroRequest filtro) {
        Long actor = ActorActual.id();
        var lista = Trazas.medir(log, "UsuarioService.buscar", () ->
            usuarioRepository.buscarConFiltros(
                            Filtros.normalizar(filtro.usuario()),
                            Filtros.normalizar(filtro.nombre()),
                            Filtros.normalizar(filtro.apellido()),
                            Filtros.normalizar(filtro.email()),
                            filtro.activo(),
                            Listas.limitado(ORDEN))
                    .stream().map(u -> respuesta(u, actor)).toList());
        return ApiResponse.ok("Usuarios encontrados.", lista);
    }

    /**
     * Roles y permisos efectivos por usuario. Con {@code ids} (max. 500) resuelve
     * solo esos usuarios (lo ideal: la pagina visible); sin ids, los primeros
     * Listas.MAX_FILAS por id. Se consulta por lotes de 200 ids para que el
     * filtro se empuje dentro de v_permisos_finales.
     */
    public ApiResponse<List<UsuarioResumenResponse>> resumen(List<Long> ids) {
        if (ids != null && ids.size() > MAX_IDS_RESUMEN) {
            throw new PeticionInvalidaException("Puedes pedir el resumen de hasta " + MAX_IDS_RESUMEN + " usuarios.");
        }
        var lista = Trazas.medir(log, "UsuarioService.resumen", () -> {
            List<Long> objetivo = ids == null || ids.isEmpty()
                    ? usuarioRepository.ids(PageRequest.of(0, Listas.MAX_FILAS))
                    : ids.stream().distinct().toList();
            List<UsuarioResumenResponse> salida = new ArrayList<>(objetivo.size());
            for (int i = 0; i < objetivo.size(); i += LOTE_RESUMEN) {
                List<Long> lote = objetivo.subList(i, Math.min(i + LOTE_RESUMEN, objetivo.size()));
                Map<Long, List<String>> roles = resolucionRepository.rolesPorUsuario(lote);
                Map<Long, List<String>> permisos = resolucionRepository.permitidosPorUsuario(lote);
                for (Long id : lote) {
                    salida.add(new UsuarioResumenResponse(id,
                            roles.getOrDefault(id, List.of()), permisos.getOrDefault(id, List.of())));
                }
            }
            return salida;
        });
        return ApiResponse.ok("Resumen de usuarios.", lista);
    }

    public ApiResponse<UsuarioResponse> obtenerPorId(Long id) {
        Long actor = ActorActual.id();
        return Trazas.medir(log, "UsuarioService.obtenerPorId", () ->
            ApiResponse.ok("Usuario encontrado.", respuesta(obtenerUsuario(id), actor)));
    }

    public ApiResponse<UsuarioResponse> crear(UsuarioCrearRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "UsuarioService.crear", () -> transacciones.ejecutar(() -> {
            String login = peticion.usuario().trim();
            String email = peticion.email().trim();
            protecciones.verificarNombreNoReservado(login);
            verificarIdentidadLibre(login, email, null);

            Usuario usuario = new Usuario();
            usuario.setUsuario(login);
            usuario.setContrasena(passwordEncoder.encode(peticion.contrasena()));
            usuario.setNombre(peticion.nombre().trim());
            usuario.setApellido(peticion.apellido().trim());
            usuario.setEmail(email);
            usuario.setTelefono(Filtros.normalizar(peticion.telefono()));
            usuario.setActivo(peticion.activo() == null ? Boolean.TRUE : peticion.activo());
            Auditoria.alCrear(usuario, actor);
            usuarioRepository.save(usuario);

            auditoria.exito(ctx, AccionAuditoria.USUARIO_CREADO, EntidadAuditoria.USUARIO, usuario.getId(),
                    Detalle.alta(Instantaneas.usuario(usuario)));
            return ApiResponse.ok("Usuario creado.", respuesta(usuario, actor));
        }));
    }

    public ApiResponse<UsuarioResponse> actualizar(Long id, UsuarioActualizarRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "UsuarioService.actualizar", () -> transacciones.ejecutar(() -> {
            Usuario usuario = obtenerUsuario(id);
            verificarNoProtegido(usuario);
            guardia.exigirAutoridadSobre(actor, id);
            Map<String, Object> antes = Instantaneas.usuario(usuario);
            boolean revocar = false;

            String nuevoLogin = Filtros.normalizar(peticion.usuario());
            if (nuevoLogin != null && !nuevoLogin.equals(usuario.getUsuario())) {
                protecciones.verificarNombreNoReservado(nuevoLogin);
                verificarIdentidadLibre(nuevoLogin, null, id);
                usuario.setUsuario(nuevoLogin);
                revocar = true;
            }
            String nuevoEmail = Filtros.normalizar(peticion.email());
            if (nuevoEmail != null && !nuevoEmail.equals(usuario.getEmail())) {
                verificarIdentidadLibre(null, nuevoEmail, id);
                usuario.setEmail(nuevoEmail);
            }
            boolean cambiaContrasena = peticion.contrasena() != null;
            if (cambiaContrasena) {
                usuario.setContrasena(passwordEncoder.encode(peticion.contrasena()));
                revocar = true;
            }
            if (peticion.nombre() != null && !peticion.nombre().isBlank()) {
                usuario.setNombre(peticion.nombre().trim());
            }
            if (peticion.apellido() != null && !peticion.apellido().isBlank()) {
                usuario.setApellido(peticion.apellido().trim());
            }
            if (peticion.telefono() != null) {
                usuario.setTelefono(Filtros.normalizar(peticion.telefono()));
            }
            if (peticion.activo() != null && !peticion.activo().equals(usuario.getActivo())) {
                usuario.setActivo(peticion.activo());
                revocar |= !peticion.activo();
            }
            if (revocar) {
                usuario.revocarCredenciales();
            }

            Auditoria.alActualizar(usuario, actor);
            usuarioRepository.save(usuario);
            if (cambiaContrasena) {
                usuarioRepository.reiniciarIntentos(id);
            }
            autorizacionCache.invalidar(id);

            Map<String, Object> despues = Instantaneas.usuario(usuario);
            if (cambiaContrasena) {
                despues.put("contrasena", "(cambiada)");
            }
            auditoria.exito(ctx, AccionAuditoria.USUARIO_ACTUALIZADO, EntidadAuditoria.USUARIO, id,
                    Detalle.cambio(antes, despues));
            if (cambiaContrasena) {
                auditoria.exito(ctx, AccionAuditoria.CONTRASENA_CAMBIADA, EntidadAuditoria.USUARIO, id,
                        Detalle.de("origen", "administracion"));
            }
            return ApiResponse.ok("Usuario actualizado.", respuesta(usuario, actor));
        }));
    }

    public ApiResponse<Void> eliminar(Long id) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        Trazas.medir(log, "UsuarioService.eliminar", () -> transacciones.ejecutar(() -> {
            Usuario usuario = obtenerUsuario(id);
            verificarNoProtegido(usuario);
            guardia.exigirAutoridadSobre(actor, id);
            Map<String, Object> antes = Instantaneas.usuario(usuario);
            usuarioRepository.delete(usuario);
            autorizacionCache.invalidar(id);
            auditoria.exito(ctx, AccionAuditoria.USUARIO_ELIMINADO, EntidadAuditoria.USUARIO, id,
                    Detalle.baja(antes));
            return null;
        }));
        return ApiResponse.<Void>ok("Usuario eliminado.", null);
    }

    public ApiResponse<UsuarioResponse> cambiarActivo(Long id, CambiarEstadoRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "UsuarioService.cambiarActivo", () -> transacciones.ejecutar(() -> {
            Usuario usuario = obtenerUsuario(id);
            verificarNoProtegido(usuario);
            guardia.exigirAutoridadSobre(actor, id);
            Boolean anterior = usuario.getActivo();
            usuario.setActivo(peticion.activo());
            if (!peticion.activo() && Boolean.TRUE.equals(anterior)) {
                usuario.revocarCredenciales(); // cierra las sesiones abiertas
            }
            Auditoria.alActualizar(usuario, actor);
            usuarioRepository.save(usuario);
            autorizacionCache.invalidar(id);

            auditoria.exito(ctx, AccionAuditoria.USUARIO_ESTADO_CAMBIADO, EntidadAuditoria.USUARIO, id,
                    Detalle.con(Detalle.cambio(Instantaneas.activo(anterior), Instantaneas.activo(peticion.activo())),
                            "motivo", peticion.motivo()));
            String mensaje = peticion.activo() ? "Usuario activado." : "Usuario desactivado.";
            return ApiResponse.ok(mensaje, respuesta(usuario, actor));
        }));
    }

    /** Respuesta con protegido = usuario protegido o la propia cuenta del actor. */
    UsuarioResponse respuesta(Usuario u, Long actor) {
        return UsuarioResponse.of(u, protecciones.esUsuarioProtegido(u.getUsuario()) || u.getId().equals(actor));
    }

    /**
     * Unicidad de usuario y email, incluido el cruce usuario<->email: si el login
     * de una cuenta coincidiera con el email de otra, el login por email de la
     * segunda dejaria de funcionar.
     */
    private void verificarIdentidadLibre(String login, String email, Long idActual) {
        if (login != null) {
            boolean ocupado = idActual == null ? usuarioRepository.existsByUsuario(login)
                    : usuarioRepository.existsByUsuarioAndIdNot(login, idActual);
            if (ocupado || (idActual == null ? usuarioRepository.existsByEmail(login)
                    : usuarioRepository.existsByEmailAndIdNot(login, idActual))) {
                throw new ConflictoException("Ya existe un usuario con ese nombre de usuario.");
            }
        }
        if (email != null) {
            boolean ocupado = idActual == null ? usuarioRepository.existsByEmail(email)
                    : usuarioRepository.existsByEmailAndIdNot(email, idActual);
            if (ocupado || (idActual == null ? usuarioRepository.existsByUsuario(email)
                    : usuarioRepository.existsByUsuarioAndIdNot(email, idActual))) {
                throw new ConflictoException("Ya existe un usuario con ese correo electrónico.");
            }
        }
    }

    private Usuario obtenerUsuario(Long id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el usuario con id " + id + "."));
    }

    private void verificarNoProtegido(Usuario usuario) {
        if (protecciones.esUsuarioProtegido(usuario.getUsuario())) {
            throw new OperacionNoPermitidaException(
                    "El usuario '" + usuario.getUsuario() + "' está protegido: no se puede modificar ni eliminar.");
        }
    }
}
