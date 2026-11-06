package oracle.admin.service;

import java.time.LocalDateTime;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import oracle.admin.model.Permiso;
import oracle.admin.model.Rol;
import oracle.admin.model.RolPermiso;
import oracle.admin.repository.PermisoRepository;
import oracle.admin.repository.RolPermisoRepository;
import oracle.admin.repository.RolRepository;
import oracle.admin.request.RolPermisoAsignarRequest;
import oracle.admin.response.PermisoResponse;
import oracle.admin.response.RolPermisoResponse;
import oracle.admin.response.RolResponse;
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
import oracle.common.support.Trazas;
import org.springframework.stereotype.Service;

/**
 * Plantilla RBAC rol-permiso (roles_permisos). ADMINISTRADOR solo recibe
 * permisos (y solo de otro ADMINISTRADOR); quitarlos queda bloqueado, igual
 * que el trigger de la base. Nadie concede ni retira un permiso que no tiene
 * ni altera un rol propio.
 */
@Slf4j
@Service
public class RolPermisoService {

    private final RolRepository rolRepository;
    private final PermisoRepository permisoRepository;
    private final RolPermisoRepository rolPermisoRepository;
    private final AutorizacionCache autorizacionCache;
    private final Transacciones transacciones;
    private final GuardiaPrivilegios guardia;
    private final RegistroAuditoria auditoria;

    public RolPermisoService(
            RolRepository rolRepository,
            PermisoRepository permisoRepository,
            RolPermisoRepository rolPermisoRepository,
            AutorizacionCache autorizacionCache,
            Transacciones transacciones,
            GuardiaPrivilegios guardia,
            RegistroAuditoria auditoria) {
        this.rolRepository = rolRepository;
        this.permisoRepository = permisoRepository;
        this.rolPermisoRepository = rolPermisoRepository;
        this.autorizacionCache = autorizacionCache;
        this.transacciones = transacciones;
        this.guardia = guardia;
        this.auditoria = auditoria;
    }

    /** Agregar un permiso al rol (unico por par). */
    public ApiResponse<RolPermisoResponse> asignar(Long rolId, RolPermisoAsignarRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "RolPermisoService.asignar", () -> transacciones.ejecutar(() -> {
            Rol rol = obtenerRol(rolId);
            Permiso permiso = obtenerPermiso(peticion.permisoId());
            guardia.exigirAdministradorSiRolAdmin(actor, rol.getNombre());
            guardia.exigirRolAjeno(actor, rolId);
            guardia.exigirPoseer(actor, List.of(permiso.getNombre()));

            if (rolPermisoRepository.existsByRolIdAndPermisoId(rolId, permiso.getId())) {
                throw new ConflictoException("El rol '" + rol.getNombre()
                        + "' ya tiene el permiso '" + permiso.getNombre() + "'.");
            }

            RolPermiso plantilla = new RolPermiso();
            plantilla.setRol(rol);
            plantilla.setPermiso(permiso);
            plantilla.setCreadoPor(actor);
            plantilla.setCreadoEn(LocalDateTime.now());
            rolPermisoRepository.save(plantilla);
            autorizacionCache.invalidarTodo();

            auditoria.exito(ctx, AccionAuditoria.PERMISO_ASIGNADO_ROL, EntidadAuditoria.ROL_PERMISO,
                    rolId + ":" + permiso.getId(),
                    Detalle.de("rol", rol.getNombre(), "permiso", permiso.getNombre()));
            return ApiResponse.ok("Permiso agregado al rol.", RolPermisoResponse.of(plantilla));
        }));
    }

    /** Quitar un permiso del rol (bloqueado para ADMINISTRADOR). */
    public ApiResponse<Void> quitar(Long rolId, Long permisoId) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        Trazas.medir(log, "RolPermisoService.quitar", () -> transacciones.ejecutar(() -> {
            Rol rol = obtenerRol(rolId);
            if (Protecciones.esRolAdministrador(rol.getNombre())) {
                throw new OperacionNoPermitidaException(
                        "Al rol ADMINISTRADOR no se le pueden quitar permisos. Solo se pueden agregar.");
            }
            Permiso permiso = obtenerPermiso(permisoId);
            guardia.exigirRolAjeno(actor, rolId);
            guardia.exigirPoseer(actor, List.of(permiso.getNombre()));
            if (!rolPermisoRepository.existsByRolIdAndPermisoId(rolId, permisoId)) {
                throw new RecursoNoEncontradoException("El rol '" + rol.getNombre()
                        + "' no tiene el permiso '" + permiso.getNombre() + "'.");
            }
            rolPermisoRepository.eliminarPar(rolId, permisoId);
            autorizacionCache.invalidarTodo();
            auditoria.exito(ctx, AccionAuditoria.PERMISO_REVOCADO_ROL, EntidadAuditoria.ROL_PERMISO,
                    rolId + ":" + permisoId,
                    Detalle.de("rol", rol.getNombre(), "permiso", permiso.getNombre()));
            return null;
        }));
        return ApiResponse.<Void>ok("Permiso quitado del rol.", null);
    }

    /** Permisos de un rol. */
    public ApiResponse<List<PermisoResponse>> listarPorRol(Long rolId) {
        var lista = Trazas.medir(log, "RolPermisoService.listarPorRol", () -> {
            obtenerRol(rolId);
            return rolPermisoRepository.permisosDeRol(rolId).stream().map(PermisoResponse::of).toList();
        });
        return ApiResponse.ok("Permisos del rol.", lista);
    }

    /** Roles que tienen un permiso. */
    public ApiResponse<List<RolResponse>> listarPorPermiso(Long permisoId) {
        var lista = Trazas.medir(log, "RolPermisoService.listarPorPermiso", () -> {
            if (!permisoRepository.existsById(permisoId)) {
                throw new RecursoNoEncontradoException("No existe el permiso con id " + permisoId + ".");
            }
            return rolPermisoRepository.rolesConPermiso(permisoId).stream().map(RolResponse::of).toList();
        });
        return ApiResponse.ok("Roles con el permiso.", lista);
    }

    private Rol obtenerRol(Long id) {
        return rolRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el rol con id " + id + "."));
    }

    private Permiso obtenerPermiso(Long id) {
        return permisoRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el permiso con id " + id + "."));
    }
}
