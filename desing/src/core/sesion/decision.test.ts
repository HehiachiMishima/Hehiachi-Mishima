import { describe, expect, it } from "vitest";
import { decidirRenovacion } from "./decision";

const MIN = 60_000;
const base = { ahora: 100 * MIN, inactividadMaxMs: 30 * MIN };

describe("decidirRenovacion", () => {
  it("con actividad reciente renueva en silencio", () => {
    expect(decidirRenovacion({ ...base, vence: base.ahora + 2 * MIN, ultimaActividad: base.ahora - 5 * MIN })).toBe("renovar");
  });
  it("inactivo y aún vigente: pregunta", () => {
    expect(decidirRenovacion({ ...base, vence: base.ahora + 2 * MIN, ultimaActividad: base.ahora - 31 * MIN })).toBe("avisar");
  });
  it("inactivo y ya vencido (equipo suspendido): cierra", () => {
    expect(decidirRenovacion({ ...base, vence: base.ahora - 1, ultimaActividad: base.ahora - 60 * MIN })).toBe("cerrar");
  });
  it("activo aunque el token ya venció: renueva (el refresh token puede seguir vivo)", () => {
    expect(decidirRenovacion({ ...base, vence: base.ahora - 1, ultimaActividad: base.ahora - MIN })).toBe("renovar");
  });
});
