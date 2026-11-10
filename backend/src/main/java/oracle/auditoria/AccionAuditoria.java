package oracle.auditoria;

/** Catalogo cerrado de acciones de la bitacora (columna accion). */
public enum AccionAuditoria {
    LOGIN_EXITOSO,
    LOGIN_FALLIDO,
    LOGIN_BLOQUEADO,
    /** Cierre de sesion voluntario (revoca la familia de refresh tokens). */
    LOGOUT,
    /** Se presento un refresh token ya usado: posible robo; se revoca la sesion entera. */
    SESION_REUTILIZADA,
    CONTRASENA_CAMBIADA,
    USUARIO_CREADO,
    USUARIO_ACTUALIZADO,
    USUARIO_ELIMINADO,
    USUARIO_ESTADO_CAMBIADO,
    /** Cierre forzado de todas las sesiones abiertas de un usuario (revoca sus tokens). */
    SESIONES_CERRADAS,
    ROL_CREADO,
    ROL_ACTUALIZADO,
    ROL_ELIMINADO,
    ROL_ESTADO_CAMBIADO,
    PERMISO_CREADO,
    PERMISO_ACTUALIZADO,
    PERMISO_ELIMINADO,
    PERMISO_ESTADO_CAMBIADO,
    ROL_ASIGNADO,
    ROL_REVOCADO,
    PERMISO_ASIGNADO_ROL,
    PERMISO_REVOCADO_ROL,
    OVERRIDE_ESTABLECIDO,
    OVERRIDE_ELIMINADO,
    ACCESO_DENEGADO,
    /** Exportacion CSV de la propia bitacora (quien exporto y con que filtros). */
    AUDITORIA_EXPORTADA
}
