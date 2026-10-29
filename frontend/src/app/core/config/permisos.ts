export const PERMISOS = {
  PANEL_ADMIN: 'PANEL_ADMIN',
  DASHBOARD_ADMIN: 'DASHBOARD_ADMIN',

  VER_USUARIOS: 'VER_USUARIOS',
  CREAR_USUARIOS: 'CREAR_USUARIOS',
  MODIFICAR_USUARIOS: 'MODIFICAR_USUARIOS',
  ELIMINAR_USUARIOS: 'ELIMINAR_USUARIOS',

  VER_ROLES: 'VER_ROLES',
  CREAR_ROLES: 'CREAR_ROLES',
  MODIFICAR_ROLES: 'MODIFICAR_ROLES',
  ELIMINAR_ROLES: 'ELIMINAR_ROLES',
  ASIGNAR_ROLES: 'ASIGNAR_ROLES',

  VER_PERMISOS: 'VER_PERMISOS',
  CREAR_PERMISOS: 'CREAR_PERMISOS',
  MODIFICAR_PERMISOS: 'MODIFICAR_PERMISOS',
  ELIMINAR_PERMISOS: 'ELIMINAR_PERMISOS',
  ASIGNAR_PERMISOS: 'ASIGNAR_PERMISOS',

  VER_AUDITORIA: 'VER_AUDITORIA',
} as const;

/**
 * Nombre legible de un código de permiso ("VER_USUARIOS" → "Ver usuarios").
 * Sirve para mensajes al usuario cuando no se dispone de la descripción del catálogo.
 */
export function etiquetaPermiso(codigo: string): string {
  const texto = codigo.toLowerCase().replace(/_/g, ' ').trim();
  return texto ? texto[0].toUpperCase() + texto.slice(1) : codigo;
}
