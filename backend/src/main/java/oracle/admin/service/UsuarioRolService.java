package oracle.admin.service;

import java.time.LocalDateTime;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import oracle.admin.model.Rol;
import oracle.admin.model.Usuario;
import oracle.admin.model.UsuarioRol;
import oracle.admin.repository.RolRepository;
import oracle.admin.repository.UsuarioRepository;
import oracle.admin.repository.UsuarioRolRepository;
import oracle.admin.request.UsuarioRolAsignarRequest;
import oracle.admin.response.RolResponse;
import oracle.admin.response.UsuarioResponse;
import oracle.admin.response.UsuarioRolResponse;
import oracle.auditoria.AccionAuditoria;
import oracle.auditoria.ContextoAuditoria;
import oracle.auditoria.Detalle;
import oracle.auditoria.EntidadAuditoria;
import oracle.auditoria.RegistroAuditoria;
import oracle.common.config.Transacciones;
import oracle.common.exception.ConflictoException;
import oracle.common.exception.OperacionNoPermitidaException;
import oracle.common.exception.RecursoNoEncontradoException;
import oracle.common.response.ApiResponse;
import oracle.common.security.AutorizacionCache;
import oracle.common.support.ActorActual;
import oracle.common.support.Listas;
import oracle.common.support.Trazas;
import org.springframework.stereotype.Service;

/**
 * Asignacion usuario-rol (usuarios_roles): dar y quitar roles. Solo sobre
 * usuarios con menos o iguales privilegios que el actor, y solo roles cuyos
 * permisos el actor tiene (ADMINISTRADOR: solo otro ADMINISTRADOR).
 */
@Slf4j
@Service
public class UsuarioRolService {

    private final UsuarioRepository usuarioRepository;
    private final RolRepository rolRepository;
    private final UsuarioRolRepository usuarioRolRepository;
    private final AutorizacionCache autorizacionCache;
    private final Transacciones transacciones;
    private final Protecciones protecciones;
    private final GuardiaPrivilegios guardia;
    private final RegistroAuditoria auditoria;

    public UsuarioRolService(
            UsuarioRepository usuarioRepository,
            RolRepository rolRepository,
            UsuarioRolRepository usuarioRolRepository,
            AutorizacionCache autorizacionCache,
            Transacciones transacciones,
            Protecciones protecciones,
            GuardiaPrivilegios guardia,
            RegistroAuditoria auditoria) {
        this.usuarioRepository = usuarioRepository;
        this.rolRepository = rolRepository;
        this.usuarioRolRepository = usuarioRolRepository;
        this.autorizacionCache = autorizacionCache;
        this.transacciones = transacciones;
        this.protecciones = protecciones;
        this.guardia = guardia;
        this.auditoria = auditoria;
    }

    /** Asignar un rol al usuario (unico por par). */
    public ApiResponse<UsuarioRolResponse> asignar(Long usuarioId, UsuarioRolAsignarRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "UsuarioRolService.asignar", () -> transacciones.ejecutar(() -> {
            Usuario usuario = obtenerUsuario(usuarioId);
            verificarNoProtegido(usuario);
            Protecciones.verificarNoAutoGestion(usuarioId, actor);
            Rol rol = obtenerRol(peticion.rolId());
            guardia.exigirAutoridadSobre(actor, usuarioId);
            guardia.exigirAdministradorSiRolAdmin(actor, rol.getNombre());
            guardia.exigirPoseerPermisosDeRol(actor, rol.getId());

            if (usuarioRolRepository.existsByUsuarioIdAndRolId(usuarioId, rol.getId())) {
                throw new ConflictoException("El usuario '" + usuario.getUsuario()
                        + "' ya tiene el rol '" + rol.getNombre() + "'.");
            }

            UsuarioRol asignacion = new UsuarioRol();
            asignacion.setUsuario(usuario);
            asignacion.setRol(rol);
            asignacion.setCreadoPor(actor);
            asignacion.setCreadoEn(LocalDateTime.now());
            usuarioRolRepository.save(asignacion);
            autorizacionCache.invalidar(usuarioId);

            auditoria.exito(ctx, AccionAuditoria.ROL_ASIGNADO, EntidadAuditoria.USUARIO_ROL,
                    usuarioId + ":" + rol.getId(),
                    Detalle.de("usuario", usuario.getUsuario(), "rol", rol.getNombre()));
            return ApiResponse.ok("Rol asignado.", UsuarioRolResponse.of(asignacion));
        }));
    }

    /** Quitar un rol al usuario. */
    public ApiResponse<Void> quitar(Long usuarioId, Long rolId) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        Trazas.medir(log, "UsuarioRolService.quitar", () -> transacciones.ejecutar(() -> {
            Usuario usuario = obtenerUsuario(usuarioId);
            Protecciones.verificarNoAutoGestion(usuarioId, actor);
            verificarNoProtegido(usuario);
            Rol rol = obtenerRol(rolId);
            guardia.exigirAutoridadSobre(actor, usuarioId);
            guardia.exigirAdministradorSiRolAdmin(actor, rol.getNombre());
            if (!usuarioRolRepository.existsByUsuarioIdAndRolId(usuarioId, rolId)) {
                throw new RecursoNoEncontradoException("El usuario '" + usuario.getUsuario()
                        + "' no tiene el rol '" + rol.getNombre() + "'.");
            }
            usuarioRolRepository.eliminarPar(usuarioId, rolId);
            autorizacionCache.invalidar(usuarioId);
            auditoria.exito(ctx, AccionAuditoria.ROL_REVOCADO, EntidadAuditoria.USUARIO_ROL,
                    usuarioId + ":" + rolId,
                    Detalle.de("usuario", usuario.getUsuario(), "rol", rol.getNombre()));
            return null;
        }));
        return ApiResponse.<Void>ok("Rol quitado.", null);
    }

    /** Roles del usuario. */
    public ApiResponse<List<RolResponse>> listarPorUsuario(Long usuarioId) {
        var lista = Trazas.medir(log, "UsuarioRolService.listarPorUsuario", () -> {
            obtenerUsuario(usuarioId);
            return usuarioRolRepository.rolesDeUsuario(usuarioId).stream()
                    .map(RolResponse::of)
                    .toList();
        });
        return ApiResponse.ok("Roles del usuario.", lista);
    }

    /** Usuarios que tienen un rol (impacto antes de desactivarlo o quitarle permisos). */
    public ApiResponse<List<UsuarioResponse>> listarPorRol(Long rolId) {
        Long actor = ActorActual.id();
        var resultado = Trazas.medir(log, "UsuarioRolService.listarPorRol", () -> {
            if (!rolRepository.existsById(rolId)) {
                throw new RecursoNoEncontradoException("No existe el rol con id " + rolId + ".");
            }
            List<UsuarioResponse> lista = usuarioRolRepository.usuariosDeRol(rolId, Listas.limitado()).stream()
                    .map(u -> UsuarioResponse.of(u,
                            protecciones.esUsuarioProtegido(u.getUsuario()) || u.getId().equals(actor)))
                    .toList();
            Listas.avisarSiCorto(log, lista.size(), "UsuarioRolService.listarPorRol");
            return lista;
        });
        return ApiResponse.ok("Usuarios con el rol.", resultado);
    }

    private Usuario obtenerUsuario(Long id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el usuario con id " + id + "."));
    }

    private Rol obtenerRol(Long id) {
        return rolRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el rol con id " + id + "."));
    }

    private void verificarNoProtegido(Usuario usuario) {
        if (protecciones.esUsuarioProtegido(usuario.getUsuario())) {
            throw new OperacionNoPermitidaException(
                    "El usuario '" + usuario.getUsuario() + "' está protegido: no se pueden cambiar sus roles.");
        }
    }
}
