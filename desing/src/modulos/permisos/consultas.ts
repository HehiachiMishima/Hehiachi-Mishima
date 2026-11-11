import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { permisosApi } from "./api";
import type { PermisoGuardar } from "./tipos";

export const claves = {
  todo: ["permisos"] as const,
  lista: ["permisos", "lista"] as const,
  uno: (id: number) => ["permisos", "uno", id] as const,
  roles: (id: number) => ["permisos", "roles", id] as const,
};

function useInvalidar() {
  const cliente = useQueryClient();
  return () => Promise.all(["permisos", "roles", "usuarios"].map((k) => cliente.invalidateQueries({ queryKey: [k] })));
}

export const usePermisos = () => useQuery({ queryKey: claves.lista, queryFn: ({ signal }) => permisosApi.listar(signal) });
export const usePermiso = (id: number) => useQuery({ queryKey: claves.uno(id), queryFn: ({ signal }) => permisosApi.obtener(id, signal) });

export function useRolesPermiso(id: number | null) {
  const { puede } = useSesion();
  return useQuery({ queryKey: claves.roles(id ?? 0), queryFn: ({ signal }) => permisosApi.roles(id!, signal), enabled: id !== null && puede(PERMISOS.VER_ROLES) });
}

export function useGuardarPermiso() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (p: { id?: number; datos: PermisoGuardar }) => (p.id ? permisosApi.actualizar(p.id, p.datos) : permisosApi.crear(p.datos)), onSettled: invalidar });
}

export function useCambiarEstadoPermiso() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (p: { id: number; activo: boolean; motivo?: string }) => permisosApi.cambiarActivo(p.id, p.activo, p.motivo), onSettled: invalidar });
}

export function useEliminarPermiso() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (id: number) => permisosApi.eliminar(id), onSettled: invalidar });
}
