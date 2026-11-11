import { describe, expect, it } from "vitest";
import { GRUPOS, MODULOS, menuPorGrupos, modulosAccesibles, rutaDe } from "./registro";

describe("registro de módulos", () => {
  it("ids únicos y grupos válidos", () => {
    const ids = MODULOS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const grupos = new Set<string>(GRUPOS.map((g) => g.id));
    MODULOS.forEach((m) => expect(grupos.has(m.grupo)).toBe(true));
    MODULOS.forEach((m) => expect(m.id).toMatch(/^[a-z][a-z0-9-]*$/));
  });

  it("filtra por permisos", () => {
    expect(modulosAccesibles([])).toEqual([]);
    expect(modulosAccesibles(["VER_USUARIOS"]).map((m) => m.id)).toEqual(["usuarios"]);
  });

  it("agrupa en el orden de GRUPOS y omite grupos vacíos", () => {
    const menu = menuPorGrupos(["VER_USUARIOS", "VER_MONITOREO"]);
    expect(menu.map((g) => g.id)).toEqual(["supervision", "gestion"]);
    expect(menuPorGrupos(["VER_USUARIOS"]).map((g) => g.id)).toEqual(["gestion"]);
  });

  it("ruta de un módulo", () => {
    expect(rutaDe({ id: "usuarios" })).toBe("/usuarios");
  });
});
