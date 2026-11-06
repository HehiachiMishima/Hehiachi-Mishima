package oracle.admin.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import oracle.admin.model.Permiso;
import oracle.admin.model.Usuario;
import oracle.admin.model.UsuarioPermiso;
import oracle.admin.repository.PermisoRepository;
import oracle.admin.repository.UsuarioPermisoRepository;
import oracle.admin.repository.UsuarioRepository;
import oracle.admin.request.UsuarioPermisoOverrideRequest;
import oracle.admin.response.PermisoResponse;
import oracle.admin.response.UsuarioPermisoResponse;
import oracle.auditoria.AccionAuditoria;
import oracle.auditoria.ContextoAuditoria;
import oracle.auditoria.Detalle;
import oracle.auditoria.EntidadAuditoria;
import oracle.auditoria.RegistroAuditoria;
import oracle.common.config.Transacciones;
import oracle.common.exception.OperacionNoPermitidaException;
import oracle.common.exception.RecursoNoEncontradoException;
import oracle.common.response.ApiResponse;
import oracle.common.security.AutorizacionCache;
import oracle.common.support.ActorActual;
import oracle.common.support.Trazas;
import org.springframework.stereotype.Service;

/**
 * Overrides individuales (usuarios_permisos): otorgado=true es un grant y
 * false un deny. Con MIN(otorgado) en la vista, el deny siempre gana. Tanto
 * el grant como el deny exigen que el actor tenga el permiso y autoridad
 * sobre el usuario (GuardiaPrivilegios).
 */
@Slf4j
@Service
public class UsuarioPermisoService {

    private final UsuarioRepository usuarioRepository;
    private final PermisoRepository permisoRepository;
    private final UsuarioPermisoRepository usuarioPermisoRepository;
    private final AutorizacionCache autorizacionCache;
    private final Transacciones transacciones;
    private final Protecciones protecciones;
    private final GuardiaPrivilegios guardia;
    private final RegistroAuditoria auditoria;

    public UsuarioPermisoService(
            UsuarioRepository usuarioRepository,
            PermisoRepository permisoRepository,
            UsuarioPermisoRepository usuarioPermisoRepository,
            AutorizacionCache autorizacionCache,
            Transacciones transacciones,
            Protecciones protecciones,
            GuardiaPrivilegios guardia,
            RegistroAuditoria auditoria) {
        this.usuarioRepository = usuarioRepository;
        this.permisoRepository = permisoRepository;
        this.usuarioPermisoRepository = usuarioPermisoRepository;
        this.autorizacionCache = autorizacionCache;
        this.transacciones = transacciones;
        this.protecciones = protecciones;
        this.guardia = guardia;
        this.auditoria = auditoria;
    }

    /** Crear o actualizar el override del permiso para el usuario. */
    public ApiResponse<UsuarioPermisoResponse> otorgar(Long usuarioId, UsuarioPermisoOverrideRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "UsuarioPermisoService.otorgar", () -> transacciones.ejecutar(() -> {
            Usuario usuario = obtenerUsuario(usuarioId);
            verificarNoProtegido(usuario);
            Protecciones.verificarNoAutoGestion(usuarioId, actor);
            Permiso permiso = permisoRepository.findById(peticion.permisoId())
                    .orElseThrow(() -> new RecursoNoEncontradoException(
                            "No existe el permiso con id " + peticion.permisoId() + "."));
            guardia.exigirAutoridadSobre(actor, usuarioId);
            guardia.exigirPoseer(actor, List.of(permiso.getNombre()));

            boolean otorgado = peticion.otorgado();
            UsuarioPermiso override = usuarioPermisoRepository
                    .findByUsuarioIdAndPermisoId(usuarioId, permiso.getId())
                    .orElse(null);
            Map<String, Object> antes = override == null ? null : Detalle.de("otorgado", override.getOtorgado());
            LocalDateTime ahora = LocalDateTime.now();

            String mensaje;
            if (override == null) {
                override = new UsuarioPermiso();
                override.setUsuario(usuario);
                override.setPermiso(permiso);
                override.setCreadoPor(actor);
                override.setCreadoEn(ahora);
                mensaje = otorgado ? "Permiso concedido al usuario." : "Permiso denegado al usuario.";
            } else {
                mensaje = otorgado
                        ? "Ajuste actualizado: el permiso queda concedido."
                        : "Ajuste actualizado: el permiso queda denegado.";
            }
            override.setOtorgado(otorgado);
            override.setActualizadoPor(actor);
            override.setActualizadoEn(ahora);
            usuarioPermisoRepository.save(override);
            autorizacionCache.invalidar(usuarioId);

            Map<String, Object> despues = Detalle.de("usuario", usuario.getUsuario(),
                    "permiso", permiso.getNombre(), "otorgado", otorgado);
            auditoria.exito(ctx, AccionAuditoria.OVERRIDE_ESTABLECIDO, EntidadAuditoria.USUARIO_PERMISO,
                    usuarioId + ":" + permiso.getId(), Detalle.cambio(antes, despues));
            return ApiResponse.ok(mensaje, UsuarioPermisoResponse.of(override));
        }));
    }

    /** Eliminar el override y volver al calculo por rol. */
    public ApiResponse<Void> eliminar(Long usuarioId, Long permisoId) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        Trazas.medir(log, "UsuarioPermisoService.eliminar", () -> transacciones.ejecutar(() -> {
            Usuario usuario = obtenerUsuario(usuarioId);
            verificarNoProtegido(usuario);
            Protecciones.verificarNoAutoGestion(usuarioId, actor);
            UsuarioPermiso override = usuarioPermisoRepository.findByUsuarioIdAndPermisoId(usuarioId, permisoId)
                    .orElseThrow(() -> new RecursoNoEncontradoException(
                            "El usuario no tiene un ajuste individual para el permiso con id " + permisoId + "."));
            String nombrePermiso = override.getPermiso().getNombre();
            guardia.exigirAutoridadSobre(actor, usuarioId);
            guardia.exigirPoseer(actor, List.of(nombrePermiso));
            Map<String, Object> antes = Detalle.de("usuario", usuario.getUsuario(),
                    "permiso", nombrePermiso, "otorgado", override.getOtorgado());
            usuarioPermisoRepository.eliminarPar(usuarioId, permisoId);
            autorizacionCache.invalidar(usuarioId);
            auditoria.exito(ctx, AccionAuditoria.OVERRIDE_ELIMINADO, EntidadAuditoria.USUARIO_PERMISO,
                    usuarioId + ":" + permisoId, Detalle.baja(antes));
            return null;
        }));
        return ApiResponse.<Void>ok("Ajuste individual eliminado.", null);
    }

    /** Overrides del usuario (grant y deny). */
    public ApiResponse<List<UsuarioPermisoResponse>> listarPorUsuario(Long usuarioId) {
        var lista = Trazas.medir(log, "UsuarioPermisoService.listarPorUsuario", () -> {
            obtenerUsuario(usuarioId);
            return usuarioPermisoRepository.deUsuario(usuarioId).stream()
                    .map(UsuarioPermisoResponse::of)
                    .toList();
        });
        return ApiResponse.ok("Ajustes individuales del usuario.", lista);
    }

    /** Solo los overrides deny (otorgado=FALSE). */
    public ApiResponse<List<UsuarioPermisoResponse>> listarDenegados(Long usuarioId) {
        var lista = Trazas.medir(log, "UsuarioPermisoService.listarDenegados", () -> {
            obtenerUsuario(usuarioId);
            return usuarioPermisoRepository.deUsuarioPorTipo(usuarioId, Boolean.FALSE).stream()
                    .map(UsuarioPermisoResponse::of)
                    .toList();
        });
        return ApiResponse.ok("Permisos denegados al usuario.", lista);
    }

    /** Permisos (entidad) sobre los que el usuario tiene un override. */
    public ApiResponse<List<PermisoResponse>> permisosConOverride(Long usuarioId) {
        var lista = Trazas.medir(log, "UsuarioPermisoService.permisosConOverride", () -> {
            obtenerUsuario(usuarioId);
            return usuarioPermisoRepository.deUsuario(usuarioId).stream()
                    .map(up -> PermisoResponse.of(up.getPermiso()))
                    .toList();
        });
        return ApiResponse.ok("Permisos con ajuste individual del usuario.", lista);
    }

    private Usuario obtenerUsuario(Long id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el usuario con id " + id + "."));
    }

    private void verificarNoProtegido(Usuario usuario) {
        if (protecciones.esUsuarioProtegido(usuario.getUsuario())) {
            throw new OperacionNoPermitidaException("El usuario '" + usuario.getUsuario()
                    + "' está protegido: no se le pueden conceder ni quitar permisos individuales.");
        }
    }
}
