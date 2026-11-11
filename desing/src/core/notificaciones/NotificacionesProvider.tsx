import { useCallback, useMemo, useState } from "react";
import type { FlashbarProps } from "@cloudscape-design/components/flashbar";
import { ContextoNotificaciones, type Aviso, type ValorNotificaciones } from "./contexto";

const MAX_AVISOS = 5;

export function NotificacionesProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<FlashbarProps.MessageDefinition[]>([]);

  const notificar = useCallback((a: Aviso) => {
    const id = a.id ?? crypto.randomUUID();
    const descartar = () => setAvisos((xs) => xs.filter((x) => x.id !== id));
    setAvisos((xs) => [{ ...a, id, dismissible: true, dismissLabel: "Descartar", onDismiss: descartar }, ...xs.filter((x) => x.id !== id)].slice(0, MAX_AVISOS));
  }, []);

  const valor = useMemo<ValorNotificaciones>(() => ({ avisos, notificar, limpiar: () => setAvisos([]) }), [avisos, notificar]);
  return <ContextoNotificaciones.Provider value={valor}>{children}</ContextoNotificaciones.Provider>;
}
