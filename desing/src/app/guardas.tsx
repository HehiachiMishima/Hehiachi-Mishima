import { Navigate, useLocation } from "react-router";
import { CargandoPagina } from "@/compartido/componentes/CargandoPagina";
import { useSesion } from "@/core/sesion/useSesion";

/** Solo con sesión: si no hay, al login recordando a dónde se quería ir. */
export function RequiereSesion({ children }: { children: React.ReactNode }) {
  const { sesion, restaurando } = useSesion();
  const ubicacion = useLocation();
  if (restaurando) return <CargandoPagina texto="Recuperando tu sesión…" />;
  if (!sesion) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />;
  return children;
}

/** Solo sin sesión (login): con sesión vuelve a donde se quería ir. */
export function SoloInvitado({ children }: { children: React.ReactNode }) {
  const { sesion, restaurando } = useSesion();
  const ubicacion = useLocation();
  if (restaurando) return <CargandoPagina texto="Recuperando tu sesión…" />;
  if (sesion) {
    const desde = (ubicacion.state as { desde?: string } | null)?.desde;
    return <Navigate to={desde && desde !== "/login" ? desde : "/"} replace />;
  }
  return children;
}

export { RequierePermiso } from "@/compartido/componentes/RequierePermiso";
