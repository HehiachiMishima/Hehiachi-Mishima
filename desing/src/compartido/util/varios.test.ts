import { describe, expect, it } from "vitest";
import { actorDeEvento, objetivoDeEvento } from "@/compartido/auditoria/etiquetas";
import type { AuditoriaEvento } from "@/compartido/auditoria/tipos";
import { contrasenaValida, REGLAS_CONTRASENA } from "./contrasena";
import { navegador } from "./navegador";

describe("contraseña", () => {
  it("exige 12 caracteres, letra y número", () => {
    expect(contrasenaValida("corta1")).toBe(false);
    expect(contrasenaValida("solo-letras-largas")).toBe(false);
    expect(contrasenaValida("frase larga 2026")).toBe(true);
    expect(REGLAS_CONTRASENA.find((r) => r.id === "maximo")!.cumple("ñ".repeat(37))).toBe(false);
  });
});

describe("navegador", () => {
  it("resume el user-agent", () => {
    expect(navegador("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36")).toBe("Chrome 131 · macOS");
    expect(navegador(null)).toBe("—");
  });
});

describe("auditoría", () => {
  const base: AuditoriaEvento = { id: 1, ocurridoEn: "", actorId: 4, actorUsuario: "ana", accion: "ROL_ASIGNADO", entidad: "USUARIO_ROL", entidadId: "4:2", resultado: "EXITO", ip: null, userAgent: null, idCorrelacion: null, detalle: null };
  it("actor legible", () => {
    expect(actorDeEvento(base)).toBe("@ana");
    expect(actorDeEvento({ ...base, actorId: 0 })).toBe("Sistema");
    expect(actorDeEvento({ ...base, actorId: null, actorUsuario: "x" })).toBe("Anónimo (x)");
  });
  it("objetivo con nombre del detalle o con ids", () => {
    expect(objetivoDeEvento({ ...base, detalle: { despues: { usuario: "ana", rolNombre: "ADMIN" } } })).toBe("Usuario · rol: ana · ADMIN");
    expect(objetivoDeEvento(base)).toBe("Usuario · rol #4 · #2");
  });
});
