import Link from "@cloudscape-design/components/link";
import { useMarco } from "./contexto";

/** Enlace "Info" para el slot `info` de un Header: abre la ayuda del módulo en el panel de herramientas. */
export function InfoAyuda() {
  const { abrirAyuda } = useMarco();
  return (
    <Link variant="info" onFollow={abrirAyuda} ariaLabel="Ayuda de esta página">
      Info
    </Link>
  );
}
