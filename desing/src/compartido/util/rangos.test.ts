import { describe, expect, it } from "vitest";
import { rangoAInstantes, rangoAUrl, rangoDesdeUrl, textoRango, validarRango } from "./rangos";

describe("rangos de fechas", () => {
  it("lee el relativo de la URL y usa el valor por defecto si no hay", () => {
    expect(rangoDesdeUrl({ rango: "24h" })).toMatchObject({ type: "relative", amount: 24, unit: "hour" });
    expect(rangoDesdeUrl({}, "7d")).toMatchObject({ amount: 7, unit: "day" });
    expect(rangoDesdeUrl({ desde: "2026-11-01T00:00:00Z", hasta: "2026-11-02T00:00:00Z" })).toMatchObject({ type: "absolute" });
  });

  it("ida y vuelta con la URL", () => {
    expect(rangoAUrl({ type: "relative", amount: 30, unit: "day" })).toEqual({ rango: "30d", desde: null, hasta: null });
    expect(rangoAUrl({ type: "absolute", startDate: "a", endDate: "b" })).toEqual({ rango: null, desde: "a", hasta: "b" });
  });

  it("ancla los relativos para que la paginación sea estable", () => {
    const ancla = Date.UTC(2026, 10, 11, 12);
    expect(rangoAInstantes({ type: "relative", amount: 1, unit: "hour" }, ancla)).toEqual({ desde: "2026-11-11T11:00:00.000Z", hasta: "2026-11-11T12:00:00.000Z" });
  });

  it("textos en español y validación de absolutos", () => {
    expect(textoRango({ type: "relative", amount: 24, unit: "hour" })).toBe("Últimas 24 horas");
    expect(textoRango({ type: "relative", amount: 7, unit: "day" })).toBe("Últimos 7 días");
    expect(validarRango({ type: "absolute", startDate: "2026-11-02", endDate: "2026-11-01" }).valid).toBe(false);
  });
});
