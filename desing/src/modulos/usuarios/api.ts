import { http } from "@/core/api/http";
import type { PermisoEfectivo, Permiso, PermisoFinal, Rol, Usuario, UsuarioGuardar, UsuarioPermisoDetalle, UsuarioResumen } from "./tipos";

/** Endpoints de usuarios, sus roles, permisos individuales y resolución. Único lugar con sus URLs. */
export const usuariosApi = {
  listar: (signal?: AbortSignal) => http.get<Usuario[]>("/usuarios", undefined, signal),
  resumen: (signal?: AbortSignal) => http.get<UsuarioResumen[]>("/usuarios/resumen", undefined, signal),
  obtener: (id: number, signal?: AbortSignal) => http.get<Usuario>(`/usuarios/${id}`, undefined, signal),
  crear: (u: UsuarioGuardar) => http.post<Usuario>("/usuarios", u),
  actualizar: (id: number, u: Partial<UsuarioGuardar>) => http.put<Usuario>(`/usuarios/${id}`, u),
  eliminar: (id: number) => http.delete<void>(`/usuarios/${id}`),
  /** `motivo` (opcional, máx. 200) queda en la auditoría. */
  cambiarActivo: (id: number, activo: boolean, motivo?: string) => http.patch<Usuario>(`/usuarios/${id}/activo`, motivo ? { activo, motivo } : { activo }),
  cerrarSesiones: (id: number, motivo?: string) => http.post<void>(`/usuarios/${id}/sesiones/cerrar`, motivo ? { motivo } : {}),

  roles: (id: number, signal?: AbortSignal) => http.get<Rol[]>(`/usuarios/${id}/roles`, undefined, signal),
  asignarRol: (id: number, rolId: number) => http.post<unknown>(`/usuarios/${id}/roles`, { rolId }),
  quitarRol: (id: number, rolId: number) => http.delete<void>(`/usuarios/${id}/roles/${rolId}`),

  ajustes: (id: number, signal?: AbortSignal) => http.get<UsuarioPermisoDetalle[]>(`/usuarios/${id}/permisos`, undefined, signal),
  fijarAjuste: (id: number, permisoId: number, otorgado: boolean) => http.put<UsuarioPermisoDetalle>(`/usuarios/${id}/permisos`, { permisoId, otorgado }),
  quitarAjuste: (id: number, permisoId: number) => http.delete<void>(`/usuarios/${id}/permisos/${permisoId}`),
  efectivos: (id: number, signal?: AbortSignal) => http.get<PermisoEfectivo[]>(`/resolucion/usuarios/${id}/efectivos`, undefined, signal),
  finales: (id: number, signal?: AbortSignal) => http.get<PermisoFinal[]>(`/resolucion/usuarios/${id}/finales`, undefined, signal),

  /** Catálogos para asignar (roles y permisos del sistema). */
  catalogoRoles: (signal?: AbortSignal) => http.get<Rol[]>("/roles", undefined, signal),
  catalogoPermisos: (signal?: AbortSignal) => http.get<Permiso[]>("/permisos", undefined, signal),
  permisosDeRol: (rolId: number, signal?: AbortSignal) => http.get<Permiso[]>(`/roles/${rolId}/permisos`, undefined, signal),
};
