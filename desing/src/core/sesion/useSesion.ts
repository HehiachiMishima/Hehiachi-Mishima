import { useSyncExternalStore } from "react";
import * as almacen from "./almacen";
import type { Permiso } from "./permisos";

/** Estado de la sesión en React (se actualiza solo al cambiar: login, renovación, cierre). */
export function useSesion() {
  const estado = useSyncExternalStore(almacen.suscribir, almacen.leerEstado);
  const permisos = estado.sesion?.permisos ?? [];
  return {
    ...estado,
    usuario: estado.sesion?.usuario ?? null,
    permisos,
    puede: (permiso: Permiso) => permisos.includes(permiso),
  };
}
