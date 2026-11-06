package oracle.admin.service;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import oracle.admin.model.Permiso;
import oracle.admin.repository.PermisoRepository;
import oracle.admin.request.CambiarEstadoRequest;
import oracle.admin.request.PermisoActualizarRequest;
import oracle.admin.request.PermisoCrearRequest;
import oracle.admin.request.PermisoFiltroRequest;
import oracle.admin.response.PermisoResponse;
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
import oracle.common.support.Auditoria;
import oracle.common.support.Filtros;
import oracle.common.support.Listas;
import oracle.common.support.Trazas;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/**
 * CRUD de permisos. Los permisos base (Protecciones.PERMISOS_BASE) estan
 * blindados: no se pueden modificar, eliminar ni ocupar su nombre, igual que
 * los triggers trg_permisos_base_update / trg_permisos_base_delete de la BD.
 * Se valida aqui para responder 403 limpio antes de que el trigger lance SQLSTATE RB403.
 */
@Slf4j
@Service
public class PermisoService {

    private static final Sort ORDEN = Sort.by("nombre");

    private final AutorizacionCache autorizacionCache;
    private final PermisoRepository permisoRepository;
    private final Transacciones transacciones;
    private final GuardiaPrivilegios guardia;
    private final RegistroAuditoria auditoria;

    public PermisoService(PermisoRepository permisoRepository, AutorizacionCache autorizacionCache,
            Transacciones transacciones, GuardiaPrivilegios guardia, RegistroAuditoria auditoria) {
        this.autorizacionCache = autorizacionCache;
        this.permisoRepository = permisoRepository;
        this.transacciones = transacciones;
        this.guardia = guardia;
        this.auditoria = auditoria;
    }

    public ApiResponse<List<PermisoResponse>> listar() {
        var resultado = Trazas.medir(log, "PermisoService.listar", () -> {
            List<PermisoResponse> lista = permisoRepository.findAll(Listas.limitado(ORDEN)).stream()
                    .map(PermisoResponse::of).toList();
            Listas.avisarSiCorto(log, lista.size(), "PermisoService.listar");
            return lista;
        });
        return ApiResponse.ok("Permisos listados.", resultado);
    }

    public ApiResponse<List<PermisoResponse>> buscar(PermisoFiltroRequest filtro) {
        var lista = Trazas.medir(log, "PermisoService.buscar", () ->
            permisoRepository.buscarConFiltros(
                            Filtros.normalizar(filtro.nombre()),
                            Filtros.normalizar(filtro.descripcion()),
                            filtro.activo(),
                            Listas.limitado(ORDEN))
                    .stream().map(PermisoResponse::of).toList());
        return ApiResponse.ok("Permisos encontrados.", lista);
    }

    public ApiResponse<PermisoResponse> obtenerPorId(Long id) {
        return Trazas.medir(log, "PermisoService.obtenerPorId", () ->
            ApiResponse.ok("Permiso encontrado.", PermisoResponse.of(obtenerPermiso(id))));
    }

    public ApiResponse<PermisoResponse> crear(PermisoCrearRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "PermisoService.crear", () -> transacciones.ejecutar(() -> {
            String nombre = peticion.nombre().trim();
            verificarNombreNoBase(nombre);
            if (permisoRepository.existsByNombre(nombre)) {
                throw new ConflictoException("Ya existe un permiso con el nombre '" + nombre + "'.");
            }

            Permiso permiso = new Permiso();
            permiso.setNombre(nombre);
            permiso.setDescripcion(Filtros.normalizar(peticion.descripcion()));
            permiso.setActivo(peticion.activo() == null ? Boolean.TRUE : peticion.activo());
            Auditoria.alCrear(permiso, actor);
            permisoRepository.save(permiso);
            // El trigger trg_permisos_after_insert lo asigna a ADMINISTRADOR.
            autorizacionCache.invalidarTodo();

            auditoria.exito(ctx, AccionAuditoria.PERMISO_CREADO, EntidadAuditoria.PERMISO, permiso.getId(),
                    Detalle.alta(Instantaneas.permiso(permiso)));
            return ApiResponse.ok("Permiso creado.", PermisoResponse.of(permiso));
        }));
    }

    public ApiResponse<PermisoResponse> actualizar(Long id, PermisoActualizarRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "PermisoService.actualizar", () -> transacciones.ejecutar(() -> {
            Permiso permiso = obtenerPermiso(id);
            boolean esBase = Protecciones.esPermisoBase(permiso.getNombre());
            Map<String, Object> antes = Instantaneas.permiso(permiso);

            String nombre = Filtros.normalizar(peticion.nombre());
            boolean cambiaNombre = nombre != null && !nombre.equals(permiso.getNombre());
            boolean cambiaDescripcion = peticion.descripcion() != null
                    && !peticion.descripcion().equals(permiso.getDescripcion());
            boolean cambiaActivo = peticion.activo() != null && !peticion.activo().equals(permiso.getActivo());
            if (esBase && (cambiaNombre || cambiaDescripcion || cambiaActivo)) {
                throw new OperacionNoPermitidaException(
                        "Los permisos base del sistema no se pueden modificar (nombre, descripción ni estado).");
            }

            if (cambiaNombre) {
                verificarNombreNoBase(nombre);
                if (permisoRepository.existsByNombreAndIdNot(nombre, id)) {
                    throw new ConflictoException("Ya existe otro permiso con el nombre '" + nombre + "'.");
                }
                permiso.setNombre(nombre);
            }
            if (cambiaDescripcion) {
                permiso.setDescripcion(Filtros.normalizar(peticion.descripcion()));
            }
            if (cambiaActivo) {
                if (peticion.activo()) {
                    guardia.exigirNoAutoBeneficio(actor, id);
                }
                permiso.setActivo(peticion.activo());
            }

            Auditoria.alActualizar(permiso, actor);
            permisoRepository.save(permiso);
            autorizacionCache.invalidarTodo();
            auditoria.exito(ctx, AccionAuditoria.PERMISO_ACTUALIZADO, EntidadAuditoria.PERMISO, id,
                    Detalle.cambio(antes, Instantaneas.permiso(permiso)));
            return ApiResponse.ok("Permiso actualizado.", PermisoResponse.of(permiso));
        }));
    }

    public ApiResponse<Void> eliminar(Long id) {
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        Trazas.medir(log, "PermisoService.eliminar", () -> transacciones.ejecutar(() -> {
            Permiso permiso = obtenerPermiso(id);
            if (Protecciones.esPermisoBase(permiso.getNombre())) {
                throw new OperacionNoPermitidaException("Los permisos base del sistema no se pueden eliminar.");
            }
            Map<String, Object> antes = Instantaneas.permiso(permiso);
            permisoRepository.delete(permiso);
            autorizacionCache.invalidarTodo();
            auditoria.exito(ctx, AccionAuditoria.PERMISO_ELIMINADO, EntidadAuditoria.PERMISO, id,
                    Detalle.baja(antes));
            return null;
        }));
        return ApiResponse.<Void>ok("Permiso eliminado.", null);
    }

    public ApiResponse<PermisoResponse> cambiarActivo(Long id, CambiarEstadoRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "PermisoService.cambiarActivo", () -> transacciones.ejecutar(() -> {
            Permiso permiso = obtenerPermiso(id);
            if (Protecciones.esPermisoBase(permiso.getNombre())) {
                throw new OperacionNoPermitidaException(
                        "Los permisos base del sistema no se pueden activar ni desactivar.");
            }
            if (peticion.activo()) {
                guardia.exigirNoAutoBeneficio(actor, id);
            }
            Boolean anterior = permiso.getActivo();
            permiso.setActivo(peticion.activo());
            Auditoria.alActualizar(permiso, actor);
            permisoRepository.save(permiso);
            autorizacionCache.invalidarTodo();

            auditoria.exito(ctx, AccionAuditoria.PERMISO_ESTADO_CAMBIADO, EntidadAuditoria.PERMISO, id,
                    Detalle.con(Detalle.cambio(Instantaneas.activo(anterior), Instantaneas.activo(peticion.activo())),
                            "motivo", peticion.motivo()));
            String mensaje = peticion.activo() ? "Permiso activado." : "Permiso desactivado.";
            return ApiResponse.ok(mensaje, PermisoResponse.of(permiso));
        }));
    }

    /** Nadie puede crear ni renombrar un permiso con el nombre de uno base (p. ej. VER_AUDITORIA antes de migrar). */
    private static void verificarNombreNoBase(String nombre) {
        if (Protecciones.esPermisoBase(nombre)) {
            throw new OperacionNoPermitidaException("El nombre '" + nombre + "' está reservado para un permiso base.");
        }
    }

    private Permiso obtenerPermiso(Long id) {
        return permisoRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el permiso con id " + id + "."));
    }
}
