import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlashbarProps } from "@cloudscape-design/components/flashbar";
import { ENTORNO } from "@/config/entorno";
import * as almacen from "@/core/sesion/almacen";
import { ContextoNotificaciones, type Aviso, type ValorNotificaciones } from "./contexto";

const MAX_AVISOS = 5;

/** Los éxitos e informaciones se retiran solos; errores y advertencias esperan a que se descarten. */
const SE_RETIRA_SOLO = new Set<FlashbarProps.Type | undefined>(["success", "info", undefined]);

export function NotificacionesProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<FlashbarProps.MessageDefinition[]>([]);
  const temporizadores = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const descartar = useCallback((id: string) => {
    clearTimeout(temporizadores.current.get(id));
    temporizadores.current.delete(id);
    setAvisos((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const notificar = useCallback(
    (a: Aviso) => {
      const id = a.id ?? crypto.randomUUID();
      clearTimeout(temporizadores.current.get(id));
      if (SE_RETIRA_SOLO.has(a.type)) temporizadores.current.set(id, setTimeout(() => descartar(id), ENTORNO.avisos.duracionMs));
      setAvisos((xs) => [{ ...a, id, dismissible: true, dismissLabel: "Descartar", onDismiss: () => descartar(id) }, ...xs.filter((x) => x.id !== id)].slice(0, MAX_AVISOS));
    },
    [descartar],
  );

  const limpiar = useCallback(() => {
    temporizadores.current.forEach(clearTimeout);
    temporizadores.current.clear();
    setAvisos([]);
  }, []);

  useEffect(() => {
    const t = temporizadores.current;
    return () => t.forEach(clearTimeout);
  }, []);

  // Al cerrar la sesión no deben quedar avisos de la sesión anterior.
  useEffect(() => almacen.suscribir(() => !almacen.leerSesion() && limpiar()), [limpiar]);

  const valor = useMemo<ValorNotificaciones>(() => ({ avisos, notificar, limpiar }), [avisos, notificar, limpiar]);
  return <ContextoNotificaciones.Provider value={valor}>{children}</ContextoNotificaciones.Provider>;
}
