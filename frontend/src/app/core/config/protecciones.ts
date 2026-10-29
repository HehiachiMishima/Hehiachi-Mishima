import { Permiso, Rol, Usuario } from '../models';
import { PERMISOS } from './permisos';

/**
 * Espejo de las reglas de protección del backend (Protecciones.java).
 * La fuente de verdad es el campo `protegido` de cada respuesta; estas listas
 * solo se usan como respaldo cuando el backend aún no lo envía, para no
 * ofrecer acciones que siempre terminarían en 403.
 */
const PERMISOS_BASE = new Set<string>(Object.values(PERMISOS));
const ROL_ADMINISTRADOR = 'ADMINISTRADOR';
const USUARIOS_PROTEGIDOS = ['@admin', '@hehiachi'];

export const MOTIVO_PROTECCION = {
  permiso: 'Permiso base del sistema: no se puede modificar ni eliminar.',
  rol: 'Rol protegido del sistema: no se puede modificar ni eliminar; solo se le pueden agregar permisos.',
  usuario: 'Cuenta protegida del sistema: no se puede modificar ni eliminar.',
  propio: 'No puedes modificar tus propios accesos ni desactivar tu cuenta.',
} as const;

export function permisoProtegido(permiso: Permiso): boolean {
  return permiso.protegido ?? PERMISOS_BASE.has(permiso.nombre);
}

export function rolProtegido(rol: Rol): boolean {
  return rol.protegido ?? rol.nombre.toUpperCase() === ROL_ADMINISTRADOR;
}

/** Cuenta protegida del sistema (independiente de quién tenga la sesión). */
export function usuarioDelSistema(usuario: Usuario): boolean {
  return USUARIOS_PROTEGIDOS.some((login) => login.toLowerCase() === usuario.usuario.toLowerCase());
}

/**
 * Protección de un usuario respecto de la sesión actual. `propio` impide
 * gestionar los propios accesos; `sistema` bloquea cualquier cambio.
 */
export function proteccionUsuario(usuario: Usuario, idSesion: number | null): 'sistema' | 'propio' | null {
  if (idSesion !== null && usuario.id === idSesion) {
    return 'propio';
  }
  if (usuarioDelSistema(usuario) || usuario.protegido === true) {
    return 'sistema';
  }
  return null;
}
