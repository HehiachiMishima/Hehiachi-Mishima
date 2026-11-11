import { useQuery } from "@tanstack/react-query";
import { http } from "@/core/api/http";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";

/** Entrada mínima del directorio de usuarios (para filtros por persona y "creado por"). */
export interface EntradaDirectorio {
  id: number;
  usuario: string;
  nombre: string;
  apellido: string;
}

/**
 * Directorio de usuarios cacheado y compartido entre módulos (misma clave → una sola petición).
 * Solo se pide si la sesión puede ver usuarios; si no, queda vacío y los filtros usan el id.
 */
export function useDirectorioUsuarios() {
  const { puede } = useSesion();
  const consulta = useQuery({
    queryKey: ["directorio-usuarios"],
    queryFn: ({ signal }) => http.get<EntradaDirectorio[]>("/usuarios", undefined, signal),
    enabled: puede(PERMISOS.VER_USUARIOS),
    staleTime: 5 * 60_000,
  });
  const lista = consulta.data ?? [];
  const porId = new Map(lista.map((u) => [u.id, u]));
  return { lista, porId, cargando: consulta.isPending && consulta.fetchStatus !== "idle" };
}
