import { createContext, useContext } from "react";
import type { AppLayoutProps } from "@cloudscape-design/components/app-layout";
import type { BreadcrumbGroupProps } from "@cloudscape-design/components/breadcrumb-group";

/**
 * Contrato entre una página y el marco de la consola (layout/Shell), sin que la página dependa
 * del layout: migas adicionales, tipo de contenido y panel dividido (detalle de un elemento).
 */
export interface PanelDivididoDef {
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
}

export interface ValorMarco {
  fijarMigas: (migas: BreadcrumbGroupProps.Item[]) => void;
  fijarTipo: (tipo: AppLayoutProps.ContentType | null) => void;
  fijarPanel: (panel: PanelDivididoDef | null) => void;
  /** Nodo DOM dentro del SplitPanel donde la página renderiza su contenido (portal). */
  contenedorPanel: HTMLElement | null;
}

export const ContextoMarco = createContext<ValorMarco | null>(null);

export function useMarco(): ValorMarco {
  const v = useContext(ContextoMarco);
  if (!v) throw new Error("useMarco fuera del marco de la consola");
  return v;
}
