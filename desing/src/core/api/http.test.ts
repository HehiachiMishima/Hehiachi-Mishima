import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as almacen from "@/core/sesion/almacen";
import type { Sesion } from "@/core/sesion/tipos";
import { ErrorApi } from "./errores";
import { _reiniciarRenovacion, http, renovar } from "./http";

const sesion = (token: string, minutos = 15): Sesion => ({
  token,
  tipo: "Bearer",
  expiraEn: new Date(Date.now() + minutos * 60_000).toISOString(),
  usuario: { id: 1, usuario: "@ana", nombre: "Ana", apellido: "Pérez", email: "a@x.test" },
  permisos: ["VER_USUARIOS"],
});

const ok = (datos: unknown) => new Response(JSON.stringify({ exito: true, mensaje: "", datos }), { status: 200 });
const error = (status: number, mensaje = "x") => new Response(JSON.stringify({ status, mensaje }), { status });

let fetchMock: ReturnType<typeof vi.fn>;
const auth = (i: number) => (fetchMock.mock.calls[i][1] as RequestInit).headers as Record<string, string>;

beforeEach(() => {
  almacen.reiniciarParaPruebas();
  _reiniciarRenovacion();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("http", () => {
  it("envía el Bearer y desempaqueta datos", async () => {
    almacen.iniciar(sesion("t1"));
    fetchMock.mockResolvedValueOnce(ok([1, 2]));
    await expect(http.get("/usuarios", { activo: true, vacio: "" })).resolves.toEqual([1, 2]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/usuarios?activo=true");
    expect(auth(0).Authorization).toBe("Bearer t1");
  });

  it("ante un 401 renueva una vez y repite la petición con el token nuevo", async () => {
    almacen.iniciar(sesion("viejo"));
    fetchMock.mockResolvedValueOnce(error(401)).mockResolvedValueOnce(ok(sesion("nuevo"))).mockResolvedValueOnce(ok("bien"));
    await expect(http.get("/usuarios")).resolves.toBe("bien");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/refresh");
    expect(auth(1).Authorization).toBeUndefined(); // refresh nunca lleva Bearer
    expect(auth(1)["X-Requested-With"]).toBe("XMLHttpRequest");
    expect(auth(2).Authorization).toBe("Bearer nuevo");
  });

  it("varias peticiones con 401 a la vez comparten UNA renovación", async () => {
    almacen.iniciar(sesion("viejo"));
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url === "/api/auth/refresh") return ok(sesion("nuevo"));
      const h = init.headers as Record<string, string>;
      return h.Authorization === "Bearer nuevo" ? ok("ok") : error(401);
    });
    await Promise.all([http.get("/a"), http.get("/b"), http.get("/c")]);
    expect(fetchMock.mock.calls.filter((c) => c[0] === "/api/auth/refresh")).toHaveLength(1);
  });

  it("si no se puede renovar, cierra la sesión como revocada y lanza el 401", async () => {
    almacen.iniciar(sesion("t"));
    fetchMock.mockResolvedValueOnce(error(401, "Tu sesión ya no es válida.")).mockResolvedValueOnce(error(401));
    await expect(http.get("/usuarios")).rejects.toMatchObject({ status: 401 });
    expect(almacen.leerEstado()).toMatchObject({ sesion: null, motivoFin: "revocada" });
  });

  it("los errores traen mensaje, campos e id de petición", async () => {
    almacen.iniciar(sesion("t"));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 400, mensaje: "Datos inválidos", campos: { email: "Requerido" } }), {
        status: 400,
        headers: { "X-Request-Id": "req-1" },
      }),
    );
    const e = (await http.post("/usuarios", {}).catch((x) => x)) as ErrorApi;
    expect(e).toBeInstanceOf(ErrorApi);
    expect(e).toMatchObject({ status: 400, message: "Datos inválidos", campos: { email: "Requerido" }, idPeticion: "req-1", esDeCliente: true });
  });

  it("sin red lanza ErrorApi con status 0", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(http.get("/x")).rejects.toMatchObject({ status: 0 });
  });

  it("renovar nunca lanza: false si el servidor rechaza", async () => {
    fetchMock.mockResolvedValueOnce(error(401));
    await expect(renovar()).resolves.toBe(false);
  });
});
