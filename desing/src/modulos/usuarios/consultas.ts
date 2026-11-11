import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { usuariosApi } from "./api";
import type { Ajuste, Permiso, PermisoEfectivo, Rol, UsuarioGuardar } from "./tipos";

export const claves = {
  todo: ["usuarios"] as const,
  lista: ["usuarios", "lista"] as const,
  resumen: ["usuarios", "resumen"] as const,
  uno: (id: number) => ["usuarios", "uno", id] as const,
  roles: (id: number) => ["usuarios", "roles", id] as const,
  permisos: (id: number) => ["usuarios", "permisos", id] as const,
  catalogoRoles: ["usuarios", "catalogo-roles"] as const,
};

/** Tras cualquier cambio se refresca el módulo y el directorio compartido de usuarios. */
function useInvalidar() {
  const cliente = useQueryClient();
  return () => Promise.all([cliente.invalidateQueries({ queryKey: claves.todo }), cliente.invalidateQueries({ queryKey: ["directorio-usuarios"] })]);
}

export const useUsuarios = () => useQuery({ queryKey: claves.lista, queryFn: ({ signal }) => usuariosApi.listar(signal) });

/** Roles y permisos efectivos de todos (una petición). Si la sesión no puede verlo, queda en error y la UI lo omite. */
export const useResumenAccesos = () => useQuery({ queryKey: claves.resumen, queryFn: ({ signal }) => usuariosApi.resumen(signal), retry: false });

/** `id` 0 = sin usuario (formulario de alta): no se pide nada. */
export const useUsuario = (id: number) => useQuery({ queryKey: claves.uno(id), queryFn: ({ signal }) => usuariosApi.obtener(id, signal), enabled: id > 0 });

export function useCatalogoRoles() {
  const { puede } = useSesion();
  return useQuery({
    queryKey: claves.catalogoRoles,
    queryFn: ({ signal }) => usuariosApi.catalogoRoles(signal),
    enabled: puede(PERMISOS.ASIGNAR_ROLES) || puede(PERMISOS.VER_ROLES),
  });
}

export const useRolesUsuario = (id: number) => useQuery({ queryKey: claves.roles(id), queryFn: ({ signal }) => usuariosApi.roles(id, signal) });

/** Fila de la tabla de permisos de un usuario: resultado, ajuste y la explicación del porqué. */
export interface FilaPermisoUsuario {
  permiso: Permiso;
  permitido: boolean;
  ajuste: Ajuste;
  roles: string[];
  porque: string;
}

function explicar(p: Permiso, permitido: boolean, ajuste: Ajuste, roles: string[]): string {
  if (ajuste === "denegar") return "Denegado explícitamente a este usuario (la denegación prevalece sobre cualquier rol).";
  if (!p.activo) return "Sin efecto: el permiso está inactivo.";
  if (permitido && roles.length) {
    return `Concedido por ${roles.length === 1 ? "el rol" : "los roles"} ${roles.join(", ")}${ajuste === "conceder" ? " y además individualmente" : ""}.`;
  }
  if (permitido && ajuste === "conceder") return "Concedido individualmente (ningún rol lo otorga).";
  if (permitido) return "Permitido.";
  return "Ningún rol activo lo concede.";
}

/** Si /efectivos no trae los roles de origen, se deducen cruzando los roles activos con sus permisos. */
async function rolesDeOrigen(id: number, efectivos: PermisoEfectivo[], signal: AbortSignal): Promise<Map<number, string[]>> {
  const deRol = efectivos.filter((e) => e.origen === "ROL" && e.otorgado);
  if (deRol.every((e) => Array.isArray(e.roles))) return new Map(deRol.map((e) => [e.permisoId, e.roles ?? []]));
  const roles = (await usuariosApi.roles(id, signal)).filter((r: Rol) => r.activo);
  const pares = await Promise.all(roles.map(async (r) => ({ r, permisos: await usuariosApi.permisosDeRol(r.id, signal) })));
  const mapa = new Map<number, string[]>();
  for (const { r, permisos } of pares) for (const p of permisos) mapa.set(p.id, [...(mapa.get(p.id) ?? []), r.nombre]);
  return mapa;
}

export const usePermisosUsuario = (id: number) =>
  useQuery({
    queryKey: claves.permisos(id),
    queryFn: async ({ signal }) => {
      const [catalogo, ajustes, finales, efectivos] = await Promise.all([
        usuariosApi.catalogoPermisos(signal),
        usuariosApi.ajustes(id, signal),
        usuariosApi.finales(id, signal),
        usuariosApi.efectivos(id, signal),
      ]);
      const origen = await rolesDeOrigen(id, efectivos, signal);
      const permitidos = new Set(finales.filter((f) => f.permitido).map((f) => f.permisoId));
      const overrides = new Map(ajustes.map((a) => [a.permisoId, a.otorgado]));
      return catalogo.map((permiso): FilaPermisoUsuario => {
        const o = overrides.get(permiso.id);
        const ajuste: Ajuste = o === true ? "conceder" : o === false ? "denegar" : "heredar";
        const roles = origen.get(permiso.id) ?? [];
        const permitido = permitidos.has(permiso.id);
        return { permiso, permitido, ajuste, roles, porque: explicar(permiso, permitido, ajuste, roles) };
      });
    },
  });

/** Alta (con roles iniciales opcionales) o edición. Devuelve el usuario guardado. */
export function useGuardarUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (p: { id?: number; datos: UsuarioGuardar; rolesIniciales?: number[] }) => {
      if (p.id) return usuariosApi.actualizar(p.id, p.datos);
      const creado = await usuariosApi.crear(p.datos);
      for (const rolId of p.rolesIniciales ?? []) await usuariosApi.asignarRol(creado.id, rolId);
      return creado;
    },
    onSettled: invalidar,
  });
}

export function useCambiarEstadoUsuario() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (p: { id: number; activo: boolean; motivo?: string }) => usuariosApi.cambiarActivo(p.id, p.activo, p.motivo), onSettled: invalidar });
}

export const useCerrarSesionesUsuario = () => useMutation({ mutationFn: (p: { id: number; motivo?: string }) => usuariosApi.cerrarSesiones(p.id, p.motivo) });

export function useEliminarUsuario() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: (id: number) => usuariosApi.eliminar(id), onSettled: invalidar });
}

export const useRestablecerContrasena = () => useMutation({ mutationFn: (p: { id: number; contrasena: string }) => usuariosApi.actualizar(p.id, { contrasena: p.contrasena }) });

export function useAlternarRol() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (p: { id: number; rolId: number; asignar: boolean }) => (p.asignar ? usuariosApi.asignarRol(p.id, p.rolId) : usuariosApi.quitarRol(p.id, p.rolId)),
    onSettled: invalidar,
  });
}

export function useAplicarAjuste() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: async (p: { id: number; permisoId: number; ajuste: Ajuste }): Promise<void> => {
      if (p.ajuste === "heredar") await usuariosApi.quitarAjuste(p.id, p.permisoId);
      else await usuariosApi.fijarAjuste(p.id, p.permisoId, p.ajuste === "conceder");
    },
    onSettled: invalidar,
  });
}
