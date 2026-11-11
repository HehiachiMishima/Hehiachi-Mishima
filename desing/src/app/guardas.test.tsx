import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from "react-router";
import * as almacen from "@/core/sesion/almacen";
import { PERMISOS } from "@/core/sesion/permisos";
import type { Sesion } from "@/core/sesion/tipos";
import { RequierePermiso, RequiereSesion, SoloInvitado } from "./guardas";

const sesion = (permisos: string[]): Sesion => ({
  token: "t",
  tipo: "Bearer",
  expiraEn: new Date(Date.now() + 60_000).toISOString(),
  usuario: { id: 1, usuario: "@ana", nombre: "Ana", apellido: "P", email: "a@x.test" },
  permisos,
});

/** Muestra la ruta actual y su state para comprobar redirecciones. */
function Ubicacion() {
  const l = useLocation();
  return <output data-testid="ubicacion">{`${l.pathname}|${JSON.stringify(l.state)}`}</output>;
}

function montar(inicio: InitialEntry) {
  render(
    <MemoryRouter initialEntries={[inicio]}>
      <Routes>
        <Route path="/login" element={<SoloInvitado>pantalla login</SoloInvitado>} />
        <Route
          path="/usuarios"
          element={
            <RequiereSesion>
              <RequierePermiso permiso={PERMISOS.VER_USUARIOS}>pantalla usuarios</RequierePermiso>
            </RequiereSesion>
          }
        />
      </Routes>
      <Ubicacion />
    </MemoryRouter>,
  );
  return () => screen.getByTestId("ubicacion").textContent;
}

beforeEach(() => almacen.reiniciarParaPruebas());
afterEach(cleanup);

describe("guardas de rutas", () => {
  it("mientras se restaura la sesión no redirige", () => {
    const ubicacion = montar("/usuarios");
    expect(screen.getByText("Recuperando tu sesión…")).toBeTruthy();
    expect(ubicacion()).toBe("/usuarios|null");
  });

  it("sin sesión lleva al login recordando el destino", () => {
    almacen.terminar(null);
    const ubicacion = montar("/usuarios");
    expect(ubicacion()).toBe('/login|{"desde":"/usuarios"}');
    expect(screen.getByText("pantalla login")).toBeTruthy();
  });

  it("con sesión pero sin permiso muestra Sin acceso", () => {
    almacen.iniciar(sesion([]));
    montar("/usuarios");
    expect(screen.getByText("Sin acceso")).toBeTruthy();
  });

  it("con permiso muestra la página", () => {
    almacen.iniciar(sesion([PERMISOS.VER_USUARIOS]));
    montar("/usuarios");
    expect(screen.getByText("pantalla usuarios")).toBeTruthy();
  });

  it("con sesión, el login devuelve a donde se quería ir", () => {
    almacen.iniciar(sesion([PERMISOS.VER_USUARIOS]));
    const ubicacion = montar({ pathname: "/login", state: { desde: "/usuarios" } });
    expect(ubicacion()?.startsWith("/usuarios|")).toBe(true);
  });
});
