package oracle.admin.service;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import oracle.admin.model.Permiso;
import oracle.admin.repository.ResolucionRepository;
import oracle.admin.repository.RolPermisoRepository;
import oracle.admin.repository.UsuarioRolRepository;
import oracle.common.exception.OperacionNoPermitidaException;
import oracle.common.security.AutorizacionCache;
import oracle.common.support.ActorActual;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

/**
 * Regla anti-escalada de privilegios:
 * <ul>
 *   <li>nadie concede (a un rol o a un usuario) un permiso que no tiene;</li>
 *   <li>nadie actua sobre un usuario con privilegios que el no posee, ni sobre si mismo;</li>
 *   <li>el rol ADMINISTRADOR solo lo asigna, quita o amplia otro ADMINISTRADOR;</li>
 *   <li>quien no es ADMINISTRADOR no altera un rol que el mismo tiene asignado.</li>
 * </ul>
 * El actor 0 (sistema) queda exento. Los permisos del actor salen de
 * AutorizacionCache (los mismos con los que se autorizo la peticion).
 */
@Component
class GuardiaPrivilegios {

    private final AutorizacionCache autorizacionCache;
    private final ResolucionRepository resolucionRepository;
    private final UsuarioRolRepository usuarioRolRepository;
    private final RolPermisoRepository rolPermisoRepository;

    GuardiaPrivilegios(AutorizacionCache autorizacionCache,
                       ResolucionRepository resolucionRepository,
                       UsuarioRolRepository usuarioRolRepository,
                       RolPermisoRepository rolPermisoRepository) {
        this.autorizacionCache = autorizacionCache;
        this.resolucionRepository = resolucionRepository;
        this.usuarioRolRepository = usuarioRolRepository;
        this.rolPermisoRepository = rolPermisoRepository;
    }

    boolean esAdministrador(Long usuarioId) {
        return usuarioRolRepository.rolesDeUsuario(usuarioId).stream()
                .anyMatch(r -> Protecciones.esRolAdministrador(r.getNombre()) && Boolean.TRUE.equals(r.getActivo()));
    }

    /** El actor debe poseer TODOS los permisos que pretende conceder o retirar. */
    void exigirPoseer(Long actor, Collection<String> permisos) {
        if (esSistema(actor)) {
            return;
        }
        Set<String> propios = permisosDe(actor);
        for (String p : permisos) {
            if (!propios.contains(p)) {
                throw new OperacionNoPermitidaException(
                        "No puedes conceder ni retirar el permiso '" + p + "' porque no lo tienes.");
            }
        }
    }

    /**
     * Igual que exigirPoseer con todos los permisos de un rol. Un ADMINISTRADOR
     * no necesita poseer los inactivos (nadie los posee y no conceden nada); a
     * los demas se les exigen tambien, para que no puedan asignar un rol con un
     * permiso apagado y reactivarlo despues.
     */
    void exigirPoseerPermisosDeRol(Long actor, Long rolId) {
        if (esSistema(actor)) {
            return;
        }
        boolean admin = esAdministrador(actor);
        exigirPoseer(actor, rolPermisoRepository.permisosDeRol(rolId).stream()
                .filter(p -> !admin || Boolean.TRUE.equals(p.getActivo()))
                .map(Permiso::getNombre)
                .toList());
    }

    /** El objetivo no puede ser el actor ni tener privilegios que el actor no tenga. */
    void exigirAutoridadSobre(Long actor, Long objetivo) {
        if (esSistema(actor)) {
            return;
        }
        if (actor.equals(objetivo)) {
            throw new OperacionNoPermitidaException(
                    "No puedes gestionar tu propia cuenta desde la administración. Usa tu perfil.");
        }
        if (esAdministrador(objetivo) && !esAdministrador(actor)) {
            throw new OperacionNoPermitidaException("Solo un ADMINISTRADOR puede gestionar a otro ADMINISTRADOR.");
        }
        Set<String> delObjetivo = new HashSet<>(resolucionRepository.nombresPermitidos(objetivo));
        if (!permisosDe(actor).containsAll(delObjetivo)) {
            throw new OperacionNoPermitidaException(
                    "No puedes gestionar a este usuario: tiene permisos que tú no tienes.");
        }
    }

    /** Solo un ADMINISTRADOR asigna, quita o amplia el rol ADMINISTRADOR. */
    void exigirAdministradorSiRolAdmin(Long actor, String nombreRol) {
        if (!esSistema(actor) && Protecciones.esRolAdministrador(nombreRol) && !esAdministrador(actor)) {
            throw new OperacionNoPermitidaException("Solo un ADMINISTRADOR puede gestionar el rol ADMINISTRADOR.");
        }
    }

    /** Quien no es ADMINISTRADOR no altera un rol que el mismo tiene asignado. */
    void exigirRolAjeno(Long actor, Long rolId) {
        if (esSistema(actor) || esAdministrador(actor)) {
            return;
        }
        boolean propio = usuarioRolRepository.existsByUsuarioIdAndRolId(actor, rolId);
        if (propio) {
            throw new OperacionNoPermitidaException("No puedes modificar un rol que tienes asignado.");
        }
    }

    /** Reactivar un permiso que el actor recibiria (por rol o grant) seria autoconcedérselo. */
    void exigirNoAutoBeneficio(Long actor, Long permisoId) {
        if (esSistema(actor) || esAdministrador(actor)) {
            return;
        }
        if (resolucionRepository.recibiriaPermiso(actor, permisoId)) {
            throw new OperacionNoPermitidaException(
                    "No puedes activar un permiso que tú mismo recibirías. Pídeselo a un ADMINISTRADOR.");
        }
    }

    private Set<String> permisosDe(Long usuarioId) {
        Set<String> s = new HashSet<>();
        for (GrantedAuthority a : autorizacionCache.cargar(usuarioId).autoridades()) {
            s.add(a.getAuthority());
        }
        return s;
    }

    private static boolean esSistema(Long actor) {
        return actor == null || ActorActual.SISTEMA.equals(actor);
    }
}
