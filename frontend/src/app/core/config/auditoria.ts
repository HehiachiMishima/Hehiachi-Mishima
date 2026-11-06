import { AuditoriaEvento } from '../models';
import { formatearLogin } from '../../shared/util/formato';

/** Etiquetas legibles y agrupaciones de la bitácora de auditoría. */

export const ACCIONES_AUDITORIA: Record<string, string> = {
  LOGIN_EXITOSO: 'Inicio de sesión',
  LOGIN_FALLIDO: 'Inicio de sesión fallido',
  LOGIN_BLOQUEADO: 'Inicio de sesión bloqueado',
  CONTRASENA_CAMBIADA: 'Contraseña cambiada',
  USUARIO_CREADO: 'Usuario creado',
  USUARIO_ACTUALIZADO: 'Usuario actualizado',
  USUARIO_ELIMINADO: 'Usuario eliminado',
  USUARIO_ESTADO_CAMBIADO: 'Estado de usuario cambiado',
  ROL_CREADO: 'Rol creado',
  ROL_ACTUALIZADO: 'Rol actualizado',
  ROL_ELIMINADO: 'Rol eliminado',
  ROL_ESTADO_CAMBIADO: 'Estado de rol cambiado',
  PERMISO_CREADO: 'Permiso creado',
  PERMISO_ACTUALIZADO: 'Permiso actualizado',
  PERMISO_ELIMINADO: 'Permiso eliminado',
  PERMISO_ESTADO_CAMBIADO: 'Estado de permiso cambiado',
  ROL_ASIGNADO: 'Rol asignado',
  ROL_REVOCADO: 'Rol revocado',
  PERMISO_ASIGNADO_ROL: 'Permiso agregado a un rol',
  PERMISO_REVOCADO_ROL: 'Permiso quitado de un rol',
  OVERRIDE_ESTABLECIDO: 'Ajuste individual establecido',
  OVERRIDE_ELIMINADO: 'Ajuste individual eliminado',
  ACCESO_DENEGADO: 'Acceso denegado',
  AUDITORIA_EXPORTADA: 'Bitácora exportada',
};

export const GRUPOS_ACCIONES: { nombre: string; acciones: string[] }[] = [
  { nombre: 'Sesión', acciones: ['LOGIN_EXITOSO', 'LOGIN_FALLIDO', 'CONTRASENA_CAMBIADA'] },
  { nombre: 'Usuarios', acciones: ['USUARIO_CREADO', 'USUARIO_ACTUALIZADO', 'USUARIO_ELIMINADO', 'USUARIO_ESTADO_CAMBIADO'] },
  { nombre: 'Roles', acciones: ['ROL_CREADO', 'ROL_ACTUALIZADO', 'ROL_ELIMINADO', 'ROL_ESTADO_CAMBIADO'] },
  {
    nombre: 'Permisos',
    acciones: ['PERMISO_CREADO', 'PERMISO_ACTUALIZADO', 'PERMISO_ELIMINADO', 'PERMISO_ESTADO_CAMBIADO'],
  },
  {
    nombre: 'Asignaciones',
    acciones: [
      'ROL_ASIGNADO',
      'ROL_REVOCADO',
      'PERMISO_ASIGNADO_ROL',
      'PERMISO_REVOCADO_ROL',
      'OVERRIDE_ESTABLECIDO',
      'OVERRIDE_ELIMINADO',
    ],
  },
  { nombre: 'Seguridad', acciones: ['ACCESO_DENEGADO', 'LOGIN_BLOQUEADO', 'AUDITORIA_EXPORTADA'] },
];

export const ENTIDADES_AUDITORIA: Record<string, string> = {
  USUARIO: 'Usuario',
  ROL: 'Rol',
  PERMISO: 'Permiso',
  USUARIO_ROL: 'Usuario · rol',
  ROL_PERMISO: 'Rol · permiso',
  USUARIO_PERMISO: 'Usuario · permiso',
  SESION: 'Sesión',
};

export const RESULTADOS_AUDITORIA: Record<string, { etiqueta: string; icono: string; tono: string }> = {
  EXITO: { etiqueta: 'Éxito', icono: 'check', tono: 'success' },
  FALLO: { etiqueta: 'Fallo', icono: 'alertTriangle', tono: 'warning' },
  DENEGADO: { etiqueta: 'Denegado', icono: 'lock', tono: 'danger' },
};

/** Acciones que modifican privilegios (para indicadores del Resumen). */
export const ACCIONES_PRIVILEGIO = ['ROL_ASIGNADO', 'OVERRIDE_ESTABLECIDO', 'PERMISO_ASIGNADO_ROL'];

/** Máximo de filas que el backend exporta a CSV (y tope del total que informa). */
export const LIMITE_EXPORTACION = 50_000;

export function etiquetaAccion(accion: string): string {
  return ACCIONES_AUDITORIA[accion] ?? accion;
}

export function etiquetaEntidad(entidad: string | null): string {
  return entidad ? (ENTIDADES_AUDITORIA[entidad] ?? entidad) : '—';
}

/** Quién hizo la acción: "@ana", "Sistema" o "Anónimo". */
export function actorDeEvento(evento: AuditoriaEvento): string {
  if (evento.actorId === 0) {
    return 'Sistema';
  }
  if (evento.actorId === null) {
    return evento.actorUsuario ? `Anónimo (${evento.actorUsuario})` : 'Anónimo';
  }
  return formatearLogin(evento.actorUsuario ?? `#${evento.actorId}`);
}

const CAMPOS_NOMBRE = ['usuario', 'nombre', 'rolNombre', 'permisoNombre'];

/** Sobre qué registro: nombre legible si el detalle lo trae, si no el id. */
export function objetivoDeEvento(evento: AuditoriaEvento): string {
  if (!evento.entidad) {
    return '—';
  }
  const datos = { ...(evento.detalle?.antes ?? {}), ...(evento.detalle?.despues ?? {}) };
  const partes = CAMPOS_NOMBRE.map((campo) => datos[campo]).filter((valor) => typeof valor === 'string');
  const entidad = etiquetaEntidad(evento.entidad);
  if (partes.length) {
    return `${entidad}: ${partes.join(' · ')}`;
  }
  return evento.entidadId ? `${entidad} #${evento.entidadId.replace(':', ' · #')}` : entidad;
}

export type RangoAuditoria = 'hoy' | '24h' | '7d' | '30d' | 'personalizado';

export const RANGOS_AUDITORIA: { id: RangoAuditoria; etiqueta: string }[] = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: '24h', etiqueta: 'Últimas 24 h' },
  { id: '7d', etiqueta: 'Últimos 7 días' },
  { id: '30d', etiqueta: 'Últimos 30 días' },
  { id: 'personalizado', etiqueta: 'Personalizado' },
];

export const RANGO_POR_DEFECTO: RangoAuditoria = '7d';

/** Inicio del rango relativo (null para "personalizado"). */
export function inicioDeRango(rango: RangoAuditoria, ahora = new Date()): Date | null {
  switch (rango) {
    case 'hoy':
      return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    case '24h':
      return new Date(ahora.getTime() - 86_400_000);
    case '7d':
      return new Date(ahora.getTime() - 7 * 86_400_000);
    case '30d':
      return new Date(ahora.getTime() - 30 * 86_400_000);
    default:
      return null;
  }
}
