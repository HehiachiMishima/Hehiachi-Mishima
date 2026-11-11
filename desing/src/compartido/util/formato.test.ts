import { describe, expect, it } from "vitest";
import { aFecha, bytes, duracion, haceCuanto, login, porcentaje } from "./formato";

describe("formato", () => {
  it("sin zona se interpreta en la zona del negocio; con zona, tal cual", () => {
    expect(aFecha("2026-11-10T09:00:00", "America/Lima")?.toISOString()).toBe("2026-11-10T14:00:00.000Z");
    expect(aFecha("2026-11-10T14:00:00", "UTC")?.toISOString()).toBe("2026-11-10T14:00:00.000Z");
    expect(aFecha("2026-07-01T12:00:00.123456", "Europe/Madrid")?.toISOString()).toBe("2026-07-01T10:00:00.123Z");
    expect(aFecha("2026-11-10T09:00:00-05:00")?.toISOString()).toBe("2026-11-10T14:00:00.000Z");
    expect(aFecha("no es fecha")).toBeNull();
    expect(aFecha(null)).toBeNull();
  });
  it("tiempo relativo", () => {
    const ahora = Date.parse("2026-11-10T14:00:00Z");
    expect(haceCuanto("2026-11-10T13:57:00Z", ahora)).toBe("hace 3 minutos");
    expect(haceCuanto("2026-11-10T13:59:50Z", ahora)).toBe("ahora");
  });
  it("login, porcentaje, bytes y duración", () => {
    expect(login("ana")).toBe("@ana");
    expect(login("@ana")).toBe("@ana");
    expect(login(null)).toBe("—");
    expect(porcentaje(5, 0)).toBe(0);
    expect(porcentaje(30, 20)).toBe(100);
    expect(bytes(1536)).toBe("1,5 KB");
    expect(duracion(90_061)).toBe("1 d 1 h");
    expect(duracion(3_660)).toBe("1 h 1 min");
  });
});
