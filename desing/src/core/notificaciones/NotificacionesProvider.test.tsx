import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENTORNO } from "@/config/entorno";
import { useNotificaciones, type ValorNotificaciones } from "./contexto";
import { NotificacionesProvider } from "./NotificacionesProvider";

const sonda: { api: ValorNotificaciones | null } = { api: null };
function Sonda() {
  const valor = useNotificaciones();
  useEffect(() => {
    sonda.api = valor;
  });
  return null;
}
const api = new Proxy({} as ValorNotificaciones, { get: (_, k) => sonda.api![k as keyof ValorNotificaciones] });

describe("avisos (Flashbar)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("un éxito se retira solo; un error espera a que se descarte", () => {
    render(
      <NotificacionesProvider>
        <Sonda />
      </NotificacionesProvider>,
    );
    act(() => {
      api.notificar({ type: "success", content: "Guardado" });
      api.notificar({ type: "error", content: "Falló" });
    });
    expect(api.avisos).toHaveLength(2);
    act(() => vi.advanceTimersByTime(ENTORNO.avisos.duracionMs + 10));
    expect(api.avisos.map((a) => a.type)).toEqual(["error"]);
    act(() => api.avisos[0].onDismiss?.(new CustomEvent("x")));
    expect(api.avisos).toHaveLength(0);
  });

  it("repetir el mismo id reemplaza el aviso en vez de apilarlo", () => {
    render(
      <NotificacionesProvider>
        <Sonda />
      </NotificacionesProvider>,
    );
    act(() => {
      api.notificar({ id: "x", type: "info", content: "1" });
      api.notificar({ id: "x", type: "info", content: "2" });
    });
    expect(api.avisos.map((a) => a.content)).toEqual(["2"]);
  });
});
