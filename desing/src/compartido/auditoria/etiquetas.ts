import type { StatusIndicatorProps } from "@cloudscape-design/components/status-indicator";
import { login } from "@/compartido/util/formato";
import type { AuditoriaEvento } from "./tipos";

/** Textos legibles de la bitácora (mismos que la consola Angular). */
export const ACCIONES_AUDITORIA: Record<string, string> = {
  LOGIN_EXITOSO: "Inicio de sesión",
  LOGIN_FALLIDO: "Inicio de sesión fallido",
  LOGIN_BLOQUEADO: "Inicio de sesión bloqueado",
  LOGOUT: "Cierre de sesión",
  SESION_REUTILIZADA: "Sesión robada bloqueada",
  CONTRASENA_CAMBIADA: "Contraseña cambiada",
  USUARIO_CREADO: "Usuario creado",
  USUARIO_ACTUALIZADO: "Usuario actualizado",
  USUARIO_ELIMINADO: "Usuario eliminado",
  USUARIO_ESTADO_CAMBIADO: "Estado de usuario cambiado",
  SESIONES_CERRADAS: "Sesiones cerradas",
  ROL_CREADO: "Rol creado",
  ROL_ACTUALIZADO: "Rol actualizado",
  ROL_ELIMINADO: "Rol eliminado",
  ROL_ESTADO_CAMBIADO: "Estado de rol cambiado",
  PERMISO_CREADO: "Permiso creado",
  PERMISO_ACTUALIZADO: "Permiso actualizado",
  PERMISO_ELIMINADO: "Permiso eliminado",
  PERMISO_ESTADO_CAMBIADO: "Estado de permiso cambiado",
  ROL_ASIGNADO: "Rol asignado",
  ROL_REVOCADO: "Rol revocado",
  PERMISO_ASIGNADO_ROL: "Permiso agregado a un rol",
  PERMISO_REVOCADO_ROL: "Permiso quitado de un rol",
  OVERRIDE_ESTABLECIDO: "Ajuste individual establecido",
  OVERRIDE_ELIMINADO: "Ajuste individual eliminado",
  ACCESO_DENEGADO: "Acceso denegado",
  AUDITORIA_EXPORTADA: "Bitácora exportada",
};

export const GRUPOS_ACCIONES: { nombre: string; acciones: string[] }[] = [
  { nombre: "Sesión", acciones: ["LOGIN_EXITOSO", "LOGIN_FALLIDO", "LOGOUT", "SESION_REUTILIZADA", "CONTRASENA_CAMBIADA"] },
  { nombre: "Usuarios", acciones: ["USUARIO_CREADO", "USUARIO_ACTUALIZADO", "USUARIO_ELIMINADO", "USUARIO_ESTADO_CAMBIADO", "SESIONES_CERRADAS"] },
  { nombre: "Roles", acciones: ["ROL_CREADO", "ROL_ACTUALIZADO", "ROL_ELIMINADO", "ROL_ESTADO_CAMBIADO"] },
  { nombre: "Permisos", acciones: ["PERMISO_CREADO", "PERMISO_ACTUALIZADO", "PERMISO_ELIMINADO", "PERMISO_ESTADO_CAMBIADO"] },
  { nombre: "Asignaciones", acciones: ["ROL_ASIGNADO", "ROL_REVOCADO", "PERMISO_ASIGNADO_ROL", "PERMISO_REVOCADO_ROL", "OVERRIDE_ESTABLECIDO", "OVERRIDE_ELIMINADO"] },
  { nombre: "Seguridad", acciones: ["ACCESO_DENEGADO", "LOGIN_BLOQUEADO", "AUDITORIA_EXPORTADA"] },
];

export const ENTIDADES_AUDITORIA: Record<string, string> = {
  USUARIO: "Usuario",
  ROL: "Rol",
  PERMISO: "Permiso",
  USUARIO_ROL: "Usuario · rol",
  ROL_PERMISO: "Rol · permiso",
  USUARIO_PERMISO: "Usuario · permiso",
  SESION: "Sesión",
};

export const RESULTADOS_AUDITORIA: Record<string, { etiqueta: string; tipo: StatusIndicatorProps.Type }> = {
  EXITO: { etiqueta: "Éxito", tipo: "success" },
  FALLO: { etiqueta: "Fallo", tipo: "warning" },
  DENEGADO: { etiqueta: "Denegado", tipo: "error" },
};

/** Acciones que modifican privilegios (indicador del Resumen y vista guardada de Auditoría). */
export const ACCIONES_PRIVILEGIO = ["ROL_ASIGNADO", "OVERRIDE_ESTABLECIDO", "PERMISO_ASIGNADO_ROL"];

/** Máximo de filas que el backend exporta a CSV. */
export const LIMITE_EXPORTACION = 50_000;

export const etiquetaAccion = (accion: string): string => ACCIONES_AUDITORIA[accion] ?? accion;

export const etiquetaEntidad = (entidad: string | null): string => (entidad ? (ENTIDADES_AUDITORIA[entidad] ?? entidad) : "—");

export const resultadoDe = (r: string) => RESULTADOS_AUDITORIA[r] ?? { etiqueta: r, tipo: "info" as const };

/** Quién hizo la acción: "@ana", "Sistema" o "Anónimo". */
export function actorDeEvento(e: Pick<AuditoriaEvento, "actorId" | "actorUsuario">): string {
  if (e.actorId === 0) return "Sistema";
  if (e.actorId === null) return e.actorUsuario ? `Anónimo (${e.actorUsuario})` : "Anónimo";
  return login(e.actorUsuario ?? `#${e.actorId}`);
}

const CAMPOS_NOMBRE = ["usuario", "nombre", "rolNombre", "permisoNombre"];

/** Sobre qué registro: nombre legible si el detalle lo trae; si no, el id. */
export function objetivoDeEvento(e: AuditoriaEvento): string {
  if (!e.entidad) return "—";
  const datos = { ...(e.detalle?.antes ?? {}), ...(e.detalle?.despues ?? {}) };
  const partes = CAMPOS_NOMBRE.map((c) => datos[c]).filter((v): v is string => typeof v === "string");
  const entidad = etiquetaEntidad(e.entidad);
  if (partes.length) return `${entidad}: ${partes.join(" · ")}`;
  return e.entidadId ? `${entidad} #${e.entidadId.replace(":", " · #")}` : entidad;
}
