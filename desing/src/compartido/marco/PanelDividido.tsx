import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMarco } from "./contexto";

/**
 * Detalle de un elemento en el SplitPanel de la consola (patrón Cloudscape "vista dividida").
 * Se declara dentro de la página, con su estado; el contenido se pinta en el panel del layout.
 *   <PanelDividido abierto={!!sel} titulo="Evento" onCerrar={() => setSel(null)}>…</PanelDividido>
 */
export function PanelDividido({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const { fijarPanel, contenedorPanel } = useMarco();
  const cerrar = useRef(onCerrar);
  useEffect(() => {
    cerrar.current = onCerrar;
  });

  useEffect(() => {
    fijarPanel(abierto ? { titulo, descripcion, onCerrar: () => cerrar.current() } : null);
  }, [abierto, titulo, descripcion, fijarPanel]);
  useEffect(() => () => fijarPanel(null), [fijarPanel]);

  return abierto && contenedorPanel ? createPortal(children, contenedorPanel) : null;
}
