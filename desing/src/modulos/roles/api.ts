import { http } from "@/core/api/http";
import type { Permiso, Rol, RolGuardar, UsuarioDeRol } from "./tipos";

/** Endpoints de /api/roles. Único lugar con sus URLs. */
export const rolesApi = {
  listar: (signal?: AbortSignal) => http.get<Rol[]>("/roles", undefined, signal),
  obtener: (id: number, signal?: AbortSignal) => http.get<Rol>(`/roles/${id}`, undefined, signal),
  crear: (r: RolGuardar) => http.post<Rol>("/roles", r),
  actualizar: (id: number, r: RolGuardar) => http.put<Rol>(`/roles/${id}`, r),
  eliminar: (id: number) => http.delete<void>(`/roles/${id}`),
  cambiarActivo: (id: number, activo: boolean, motivo?: string) => http.patch<Rol>(`/roles/${id}/activo`, motivo ? { activo, motivo } : { activo }),
  permisos: (id: number, signal?: AbortSignal) => http.get<Permiso[]>(`/roles/${id}/permisos`, undefined, signal),
  asignarPermiso: (id: number, permisoId: number) => http.post<unknown>(`/roles/${id}/permisos`, { permisoId }),
  quitarPermiso: (id: number, permisoId: number) => http.delete<void>(`/roles/${id}/permisos/${permisoId}`),
  usuarios: (id: number, signal?: AbortSignal) => http.get<UsuarioDeRol[]>(`/roles/${id}/usuarios`, undefined, signal),
  catalogoPermisos: (signal?: AbortSignal) => http.get<Permiso[]>("/permisos", undefined, signal),
  /** Usuarios por rol (de la analítica; requiere DASHBOARD_ADMIN). */
  usuariosPorRol: async (signal?: AbortSignal) => {
    const a = await http.get<{ usuariosPorRol: { etiqueta: string; valor: number }[] }>("/admin/analitica", undefined, signal);
    return new Map(a.usuariosPorRol.map((c) => [c.etiqueta, c.valor]));
  },
};
