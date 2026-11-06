package oracle.admin.service;

import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import oracle.common.exception.OperacionNoPermitidaException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Reglas de proteccion espejo de los triggers de la base de datos.
 * Validar aqui = fallar con 403 limpio antes de que PostgreSQL lance SQLSTATE RB403.
 *
 * Usuarios protegidos (sin update, delete ni cambios de rol/permisos desde la
 * administracion):
 * <ul>
 *   <li>{@link #USUARIO_RAIZ} (@hehiachi): ademas, la aplicacion no le deja
 *       cambiar su propia contrasena (solo la cambia el DBA).</li>
 *   <li>el usuario semilla (app.seed.usuario) y los de
 *       app.seguridad.usuarios-protegidos.</li>
 * </ul>
 * En la BD, seguridad.es_usuario_protegido() protege por nombre a @admin y
 * @hehiachi (schema.sql). Si el usuario semilla no se llama @admin, solo lo
 * protege la aplicacion. Las comparaciones no distinguen mayusculas.
 */
@Component
public class Protecciones {

    /**
     * Permisos base: inmutables. No se pueden modificar (ni siquiera su campo
     * 'activo') ni eliminar, ni ocupar su nombre. Espejo de
     * seguridad.es_permiso_base() de schema.sql (14 de gestion + PANEL_ADMIN +
     * DASHBOARD_ADMIN + VER_AUDITORIA).
     */
    public static final Set<String> PERMISOS_BASE = Set.of(
            "ASIGNAR_ROLES", "VER_ROLES", "CREAR_ROLES", "MODIFICAR_ROLES", "ELIMINAR_ROLES",
            "ASIGNAR_PERMISOS", "VER_PERMISOS", "CREAR_PERMISOS", "MODIFICAR_PERMISOS", "ELIMINAR_PERMISOS",
            "VER_USUARIOS", "CREAR_USUARIOS", "MODIFICAR_USUARIOS", "ELIMINAR_USUARIOS",
            "PANEL_ADMIN", "DASHBOARD_ADMIN", "VER_AUDITORIA");

    /** Rol que solo recibe permisos: no se modifica ni se elimina. */
    public static final String ROL_ADMINISTRADOR = "ADMINISTRADOR";

    /** Usuario raiz: protegido tambien en la BD (trigger trg_usuarios_proteger). */
    public static final String USUARIO_RAIZ = "@hehiachi";

    private final Set<String> usuariosProtegidos;

    public Protecciones(
            @Value("${app.seed.usuario:}") String usuarioSemilla,
            @Value("${app.seguridad.usuarios-protegidos:}") Set<String> adicionales) {
        this.usuariosProtegidos = Stream.concat(Stream.of(USUARIO_RAIZ, usuarioSemilla), adicionales.stream())
                .filter(u -> u != null && !u.isBlank())
                .map(u -> u.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toUnmodifiableSet());
    }

    /** True si el nombre corresponde a un permiso base (protegido por los triggers). */
    public static boolean esPermisoBase(String nombre) {
        return nombre != null && PERMISOS_BASE.contains(nombre.trim().toUpperCase(Locale.ROOT));
    }

    public static boolean esRolAdministrador(String nombre) {
        return nombre != null && ROL_ADMINISTRADOR.equalsIgnoreCase(nombre.trim());
    }

    /** Usuario protegido por la BD (no admite ningun UPDATE de identidad o credencial). */
    public static boolean esUsuarioRaiz(String usuario) {
        return usuario != null && USUARIO_RAIZ.equalsIgnoreCase(usuario.trim());
    }

    public boolean esUsuarioProtegido(String usuario) {
        return usuario != null && usuariosProtegidos.contains(usuario.trim().toLowerCase(Locale.ROOT));
    }

    /** Impide crear o renombrar una cuenta con un nombre protegido (ocupacion de @hehiachi/@admin). */
    public void verificarNombreNoReservado(String usuario) {
        if (esUsuarioProtegido(usuario)) {
            throw new OperacionNoPermitidaException(
                    "El nombre de usuario '" + usuario.trim() + "' está reservado.");
        }
    }

    /**
     * Bloquea la autoasignacion: un usuario no puede cambiar sus propios roles
     * ni concederse/quitarse permisos individuales. El actor 0 (sistema) queda exento.
     */
    static void verificarNoAutoGestion(Long usuarioAfectado, Long actor) {
        if (usuarioAfectado != null && actor != null && actor != 0L && usuarioAfectado.equals(actor)) {
            throw new OperacionNoPermitidaException("No puedes modificar tus propios roles o permisos.");
        }
    }
}
