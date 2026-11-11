import type { Permiso } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { SinAcceso } from "./SinAcceso";

/** El backend es quien autoriza; esto solo evita mostrar páginas que responderían 403. */
export function RequierePermiso({ permiso, children }: { permiso: Permiso; children: React.ReactNode }) {
  const { puede } = useSesion();
  return puede(permiso) ? children : <SinAcceso />;
}
