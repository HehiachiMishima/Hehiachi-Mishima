import { http } from "@/core/api/http";
import type { Permiso, PermisoGuardar, RolDePermiso } from "./tipos";

/** Endpoints de /api/permisos. Único lugar con sus URLs. */
export const permisosApi = {
  listar: (signal?: AbortSignal) => http.get<Permiso[]>("/permisos", undefined, signal),
  obtener: (id: number, signal?: AbortSignal) => http.get<Permiso>(`/permisos/${id}`, undefined, signal),
  crear: (p: PermisoGuardar) => http.post<Permiso>("/permisos", p),
  actualizar: (id: number, p: PermisoGuardar) => http.put<Permiso>(`/permisos/${id}`, p),
  eliminar: (id: number) => http.delete<void>(`/permisos/${id}`),
  cambiarActivo: (id: number, activo: boolean, motivo?: string) => http.patch<Permiso>(`/permisos/${id}/activo`, motivo ? { activo, motivo } : { activo }),
  roles: (id: number, signal?: AbortSignal) => http.get<RolDePermiso[]>(`/permisos/${id}/roles`, undefined, signal),
};
