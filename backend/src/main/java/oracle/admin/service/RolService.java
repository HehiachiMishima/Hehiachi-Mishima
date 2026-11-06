package oracle.admin.service;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import oracle.admin.model.Rol;
import oracle.admin.repository.RolRepository;
import oracle.admin.request.CambiarEstadoRequest;
import oracle.admin.request.RolActualizarRequest;
import oracle.admin.request.RolCrearRequest;
import oracle.admin.request.RolFiltroRequest;
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
import oracle.common.support.Auditoria;
import oracle.common.support.Filtros;
import oracle.common.support.Listas;
import oracle.common.support.Trazas;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/** CRUD de roles con filtros LIKE y protecciones del trigger de ADMINISTRADOR. */
@Slf4j
@Service
public class RolService {

    private static final Sort ORDEN = Sort.by("nombre");

    private final AutorizacionCache autorizacionCache;
    private final RolRepository rolRepository;
    private final Transacciones transacciones;
    private final GuardiaPrivilegios guardia;
    private final RegistroAuditoria auditoria;

    public RolService(RolRepository rolRepository,
            AutorizacionCache autorizacionCache, Transacciones transacciones, GuardiaPrivilegios guardia,
            RegistroAuditoria auditoria) {
        this.autorizacionCache = autorizacionCache;
        this.rolRepository = rolRepository;
        this.transacciones = transacciones;
        this.guardia = guardia;
        this.auditoria = auditoria;
    }

    public ApiResponse<List<RolResponse>> listar() {
        var resultado = Trazas.medir(log, "RolService.listar", () -> {
            List<RolResponse> lista = rolRepository.findAll(Listas.limitado(ORDEN)).stream()
                    .map(RolResponse::of).toList();
            Listas.avisarSiCorto(log, lista.size(), "RolService.listar");
            return lista;
        });
        return ApiResponse.ok("Roles listados.", resultado);
    }

    public ApiResponse<List<RolResponse>> buscar(RolFiltroRequest filtro) {
        var lista = Trazas.medir(log, "RolService.buscar", () ->
            rolRepository.buscarConFiltros(
                            Filtros.normalizar(filtro.nombre()),
                            Filtros.normalizar(filtro.descripcion()),
                            filtro.activo(),
                            Listas.limitado(ORDEN))
                    .stream().map(RolResponse::of).toList());
        return ApiResponse.ok("Roles encontrados.", lista);
    }

    public ApiResponse<RolResponse> obtenerPorId(Long id) {
        return Trazas.medir(log, "RolService.obtenerPorId", () ->
            ApiResponse.ok("Rol encontrado.", RolResponse.of(obtenerRol(id))));
    }

    public ApiResponse<RolResponse> crear(RolCrearRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "RolService.crear", () -> transacciones.ejecutar(() -> {
            String nombre = peticion.nombre().trim();
            if (rolRepository.existsByNombre(nombre)) {
                throw new ConflictoException("Ya existe un rol con el nombre '" + nombre + "'.");
            }

            Rol rol = new Rol();
            rol.setNombre(nombre);
            rol.setDescripcion(Filtros.normalizar(peticion.descripcion()));
            rol.setActivo(peticion.activo() == null ? Boolean.TRUE : peticion.activo());
            Auditoria.alCrear(rol, actor);
            rolRepository.save(rol);

            auditoria.exito(ctx, AccionAuditoria.ROL_CREADO, EntidadAuditoria.ROL, rol.getId(),
                    Detalle.alta(Instantaneas.rol(rol)));
            return ApiResponse.ok("Rol creado.", RolResponse.of(rol));
        }));
    }

    public ApiResponse<RolResponse> actualizar(Long id, RolActualizarRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "RolService.actualizar", () -> transacciones.ejecutar(() -> {
            Rol rol = obtenerRol(id);
            verificarNoAdministrador(rol);
            guardia.exigirRolAjeno(actor, id);
            Map<String, Object> antes = Instantaneas.rol(rol);

            String nombre = Filtros.normalizar(peticion.nombre());
            if (nombre != null && !nombre.equals(rol.getNombre())) {
                if (rolRepository.existsByNombreAndIdNot(nombre, id)) {
                    throw new ConflictoException("Ya existe otro rol con el nombre '" + nombre + "'.");
                }
                rol.setNombre(nombre);
            }
            if (peticion.descripcion() != null) {
                rol.setDescripcion(Filtros.normalizar(peticion.descripcion()));
            }
            boolean cambiaActivo = peticion.activo() != null && !peticion.activo().equals(rol.getActivo());
            if (cambiaActivo) {
                if (peticion.activo()) {
                    guardia.exigirPoseerPermisosDeRol(actor, id);
                }
                rol.setActivo(peticion.activo());
            }

            Auditoria.alActualizar(rol, actor);
            rolRepository.save(rol);
            if (cambiaActivo) {
                autorizacionCache.invalidarTodo();
            }
            auditoria.exito(ctx, AccionAuditoria.ROL_ACTUALIZADO, EntidadAuditoria.ROL, id,
                    Detalle.cambio(antes, Instantaneas.rol(rol)));
            return ApiResponse.ok("Rol actualizado.", RolResponse.of(rol));
        }));
    }

    public ApiResponse<Void> eliminar(Long id) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        Trazas.medir(log, "RolService.eliminar", () -> transacciones.ejecutar(() -> {
            Rol rol = obtenerRol(id);
            verificarNoAdministrador(rol);
            guardia.exigirRolAjeno(actor, id);
            Map<String, Object> antes = Instantaneas.rol(rol);
            rolRepository.delete(rol);
            autorizacionCache.invalidarTodo();
            auditoria.exito(ctx, AccionAuditoria.ROL_ELIMINADO, EntidadAuditoria.ROL, id, Detalle.baja(antes));
            return null;
        }));
        return ApiResponse.<Void>ok("Rol eliminado.", null);
    }

    public ApiResponse<RolResponse> cambiarActivo(Long id, CambiarEstadoRequest peticion) {
        Long actor = ActorActual.id();
        ContextoAuditoria ctx = ContextoAuditoria.actual();
        return Trazas.medir(log, "RolService.cambiarActivo", () -> transacciones.ejecutar(() -> {
            Rol rol = obtenerRol(id);
            verificarNoAdministrador(rol);
            guardia.exigirRolAjeno(actor, id);
            if (peticion.activo()) {
                // Reactivar devuelve sus permisos a todos sus usuarios: no se concede lo que no se tiene.
                guardia.exigirPoseerPermisosDeRol(actor, id);
            }
            Boolean anterior = rol.getActivo();
            rol.setActivo(peticion.activo());
            Auditoria.alActualizar(rol, actor);
            rolRepository.save(rol);
            autorizacionCache.invalidarTodo();

            auditoria.exito(ctx, AccionAuditoria.ROL_ESTADO_CAMBIADO, EntidadAuditoria.ROL, id,
                    Detalle.con(Detalle.cambio(Instantaneas.activo(anterior), Instantaneas.activo(peticion.activo())),
                            "motivo", peticion.motivo()));
            String mensaje = peticion.activo() ? "Rol activado." : "Rol desactivado.";
            return ApiResponse.ok(mensaje, RolResponse.of(rol));
        }));
    }

    private Rol obtenerRol(Long id) {
        return rolRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("No existe el rol con id " + id + "."));
    }

    private void verificarNoAdministrador(Rol rol) {
        if (Protecciones.esRolAdministrador(rol.getNombre())) {
            throw new OperacionNoPermitidaException(
                    "El rol ADMINISTRADOR no se puede modificar ni eliminar. Solo se le pueden agregar permisos.");
        }
    }
}
