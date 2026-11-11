import { useEffect } from "react";
import type { AppLayoutProps } from "@cloudscape-design/components/app-layout";
import type { BreadcrumbGroupProps } from "@cloudscape-design/components/breadcrumb-group";
import { useMarco } from "./contexto";

/**
 * Declara las migas que siguen a la del módulo y, si hace falta, el tipo de contenido de AppLayout
 * (p. ej. "form" en un alta). Se limpian al salir de la página.
 *   useMarcoPagina({ migas: [{ text: "@ana", href: "/usuarios/4" }], tipo: "default" });
 */
export function useMarcoPagina({ migas = [], tipo }: { migas?: BreadcrumbGroupProps.Item[]; tipo?: AppLayoutProps.ContentType }) {
  const { fijarMigas, fijarTipo } = useMarco();
  const clave = JSON.stringify(migas);
  useEffect(() => {
    fijarMigas(JSON.parse(clave) as BreadcrumbGroupProps.Item[]);
    return () => fijarMigas([]);
  }, [clave, fijarMigas]);
  useEffect(() => {
    fijarTipo(tipo ?? null);
    return () => fijarTipo(null);
  }, [tipo, fijarTipo]);
}
