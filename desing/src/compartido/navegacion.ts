import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";

/**
 * Cloudscape emite onFollow con href real (abrir en pestaña nueva funciona). El clic normal
 * se intercepta para navegar sin recargar. Úsalo en SideNavigation, BreadcrumbGroup, Link...
 */
export function useSeguirEnlace() {
  const navegar = useNavigate();
  return (e: CustomEvent<{ href?: string; external?: boolean }>) => {
    if (e.detail.external || !e.detail.href) return;
    e.preventDefault();
    navegar(e.detail.href);
  };
}

/**
 * Estado de una página en la URL (?clave=valor): enlaces compartibles y botón Atrás coherente.
 * `cambiar` fusiona; null/"" borra la clave. Por defecto vuelve a la página 1 de la lista.
 */
export function useParametrosUrl() {
  const [params, setParams] = useSearchParams();
  const cambiar = useCallback(
    (cambios: Record<string, string | number | null | undefined>, { conservarPagina = false, reemplazar = false } = {}) => {
      setParams(
        (prev) => {
          const sig = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(cambios)) {
            if (v === null || v === undefined || v === "") sig.delete(k);
            else sig.set(k, String(v));
          }
          if (!conservarPagina && !("pagina" in cambios)) sig.delete("pagina");
          return sig;
        },
        { replace: reemplazar },
      );
    },
    [setParams],
  );
  return [params, cambiar] as const;
}
