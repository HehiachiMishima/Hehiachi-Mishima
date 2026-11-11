import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { actividadApi } from "./api";
import type { FiltroPeticiones } from "./tipos";

export const usePeticiones = (f: FiltroPeticiones) =>
  useQuery({ queryKey: ["actividad", "peticiones", f], queryFn: ({ signal }) => actividadApi.peticiones(f, signal), placeholderData: keepPreviousData });

export const useActividadUsuario = (actorId: number | null, dias: number, zona: string) =>
  useQuery({
    queryKey: ["actividad", "usuario", actorId, dias, zona],
    queryFn: ({ signal }) => actividadApi.deUsuario(actorId!, dias, zona, signal),
    enabled: actorId !== null,
  });

export const useCerrarSesiones = () => useMutation({ mutationFn: (p: { id: number; motivo?: string }) => actividadApi.cerrarSesiones(p.id, p.motivo) });
