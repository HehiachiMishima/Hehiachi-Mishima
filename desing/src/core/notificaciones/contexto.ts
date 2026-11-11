import { createContext, useContext } from "react";
import type { FlashbarProps } from "@cloudscape-design/components/flashbar";

export type Aviso = Omit<FlashbarProps.MessageDefinition, "onDismiss" | "dismissible" | "dismissLabel">;

export interface ValorNotificaciones {
  avisos: FlashbarProps.MessageDefinition[];
  notificar: (aviso: Aviso) => void;
  limpiar: () => void;
}

export const ContextoNotificaciones = createContext<ValorNotificaciones | null>(null);

/** Avisos globales (Flashbar del layout). Úsalo en cualquier página: const { notificar } = useNotificaciones(). */
export function useNotificaciones(): ValorNotificaciones {
  const v = useContext(ContextoNotificaciones);
  if (!v) throw new Error("useNotificaciones fuera de <NotificacionesProvider>");
  return v;
}
