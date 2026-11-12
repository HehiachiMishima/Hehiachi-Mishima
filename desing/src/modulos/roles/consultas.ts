import { useMutation, useQuery } from "@tanstack/react-query";
import { useInvalidarGestion } from "@/compartido/datos/invalidacion";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { rolesApi } from "./api";
import type { RolGuardar } from "./tipos";

export const claves = {
  todo: ["roles"] as const,
  lista: ["roles", "lista"] as const,
  conteo: ["roles", "conteo"] as const,
  uno: (id: number) => ["roles", "uno", id] as const,
  permisos: (id: number) => ["roles", "permisos", id] as const,
  usuarios: (id: number) => ["roles", "usuarios", id] as const,
  catalogo: ["roles", "catalogo-permisos"] as const,
};


export const useRoles = () => useQuery({ queryKey: claves.lista, queryFn: ({ signal }) => rolesApi.listar(signal) });

export function useConteoUsuarios() {
  const { puede } = useSesion();
  return useQuery({ queryKey: claves.conteo, queryFn: ({ signal }) => rolesApi.usuariosPorRol(signal), enabled: puede(PERMISOS.DASHBOARD_ADMIN), retry: false });
}

export const useRol = (id: number) => useQuery({ queryKey: claves.uno(id), queryFn: ({ signal }) => rolesApi.obtener(id, signal), enabled: Number.isInteger(id) && id > 0 });
/** GET /roles/{id}/permisos exige VER_ROLES y VER_PERMISOS. */
export function usePermisosRol(id: number | null) {
  const { puede } = useSesion();
  return useQuery({ queryKey: claves.permisos(id ?? 0), queryFn: ({ signal }) => rolesApi.permisos(id!, signal), enabled: id !== null && puede(PERMISOS.VER_PERMISOS) });
}

/** GET /roles/{id}/usuarios exige VER_ROLES y VER_USUARIOS. */
export function useUsuariosRol(id: number | null) {
  const { puede } = useSesion();
  return useQuery({ queryKey: claves.usuarios(id ?? 0), queryFn: ({ signal }) => rolesApi.usuarios(id!, signal), enabled: id !== null && puede(PERMISOS.VER_USUARIOS) });
}

export function useCatalogoPermisos() {
  const { puede } = useSesion();
  return useQuery({ queryKey: claves.catalogo, queryFn: ({ signal }) => rolesApi.catalogoPermisos(signal), enabled: puede(PERMISOS.VER_PERMISOS) });
}

export function useGuardarRol() {
  const invalidar = useInvalidarGestion();
  return useMutation({ mutationFn: (p: { id?: number; datos: RolGuardar }) => (p.id ? rolesApi.actualizar(p.id, p.datos) : rolesApi.crear(p.datos)), onSettled: () => invalidar() });
}

export function useCambiarEstadoRol() {
  const invalidar = useInvalidarGestion();
  return useMutation({ mutationFn: (p: { id: number; activo: boolean; motivo?: string }) => rolesApi.cambiarActivo(p.id, p.activo, p.motivo), onSettled: () => invalidar() });
}

export function useEliminarRol() {
  const invalidar = useInvalidarGestion();
  return useMutation({ mutationFn: (id: number) => rolesApi.eliminar(id), onSettled: (_r, _e, id) => void invalidar(["roles", id]) });
}

export function useAlternarPermisoRol() {
  const invalidar = useInvalidarGestion();
  return useMutation({
    mutationFn: async (p: { id: number; permisoId: number; asignar: boolean }): Promise<void> => {
      if (p.asignar) await rolesApi.asignarPermiso(p.id, p.permisoId);
      else await rolesApi.quitarPermiso(p.id, p.permisoId);
    },
    onSettled: () => invalidar(),
  });
}
