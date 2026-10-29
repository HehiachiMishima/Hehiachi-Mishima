package oracle.auditoria;

/** Tipo de registro afectado (columna entidad). Las relaciones usan id compuesto "a:b". */
public enum EntidadAuditoria {
    USUARIO,
    ROL,
    PERMISO,
    /** entidad_id = "usuarioId:rolId". */
    USUARIO_ROL,
    /** entidad_id = "rolId:permisoId". */
    ROL_PERMISO,
    /** entidad_id = "usuarioId:permisoId". */
    USUARIO_PERMISO,
    /** entidad_id = usuarioId de la sesion (login). */
    SESION
}
