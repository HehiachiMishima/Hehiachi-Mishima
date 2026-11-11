import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Reglas de dependencias entre capas. Si una falla, la estructura se está degradando:
 * mover el código a la capa correcta en vez de relajar la regla.
 */
const RAIZ = join(__dirname);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [ruta] : [];
  });
}

/** Imports internos de un archivo, resueltos a ruta relativa a src/ (p. ej. "core/api/http"). */
function importsDe(archivo: string): string[] {
  const codigo = readFileSync(archivo, "utf8");
  return [...codigo.matchAll(/from\s+["']([^"']+)["']/g)]
    .map((m) => m[1])
    .flatMap((i) => {
      if (i.startsWith("@/")) return [i.slice(2)];
      if (i.startsWith(".")) return [relative(RAIZ, join(archivo, "..", i)).split(sep).join("/")];
      return [];
    });
}

const fuente = archivos(RAIZ).map((a) => ({ ruta: relative(RAIZ, a).split(sep).join("/"), imports: importsDe(a) }));
const capa = (r: string) => r.split("/")[0];

function violaciones(desde: (r: string) => boolean, prohibido: (i: string, r: string) => boolean) {
  return fuente.filter((f) => desde(f.ruta)).flatMap((f) => f.imports.filter((i) => prohibido(i, f.ruta)).map((i) => `${f.ruta} → ${i}`));
}

describe("arquitectura", () => {
  it("config no depende de nada interno", () => {
    expect(violaciones((r) => capa(r) === "config", () => true)).toEqual([]);
  });

  it("core no depende de app, layout, módulos ni páginas", () => {
    expect(violaciones((r) => capa(r) === "core", (i) => ["app", "layout", "modulos", "paginas"].includes(capa(i)))).toEqual([]);
  });

  it("compartido no depende de app, layout, módulos ni páginas", () => {
    expect(violaciones((r) => capa(r) === "compartido", (i) => ["app", "layout", "modulos", "paginas"].includes(capa(i)))).toEqual([]);
  });

  it("un módulo no importa otro módulo", () => {
    const modulo = (r: string) => (r.startsWith("modulos/") ? r.split("/")[1] : null);
    expect(
      violaciones(
        (r) => r.startsWith("modulos/") && r !== "modulos/registro.ts",
        (i, r) => i.startsWith("modulos/") && i !== "modulos/registro" && modulo(i) !== modulo(r),
      ),
    ).toEqual([]);
  });

  it("un módulo no depende de app, layout ni páginas (le habla al marco por compartido/marco)", () => {
    expect(violaciones((r) => r.startsWith("modulos/"), (i) => ["app", "layout", "paginas"].includes(capa(i)))).toEqual([]);
  });

  it("los componentes de un módulo no llaman a la API (reciben datos por props)", () => {
    expect(violaciones((r) => /^modulos\/[^/]+\/componentes\//.test(r), (i) => /\/api$|core\/api\/http/.test(i))).toEqual([]);
  });

  it("solo core/api/http.ts usa fetch", () => {
    const conFetch = archivos(RAIZ)
      .filter((a) => /\bfetch\(/.test(readFileSync(a, "utf8")))
      .map((a) => relative(RAIZ, a).split(sep).join("/"));
    expect(conFetch).toEqual(["core/api/http.ts"]);
  });
});
