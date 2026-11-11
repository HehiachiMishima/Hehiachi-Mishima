import { ENTORNO } from "@/config/entorno";
import * as almacen from "@/core/sesion/almacen";
import type { Sesion } from "@/core/sesion/tipos";
import { ErrorApi } from "./errores";
import type { ApiErrorCuerpo, ApiResponse } from "./tipos";

/**
 * Cliente HTTP único de la app.
 * - Añade el Bearer (access token en memoria) salvo en las rutas de sesión.
 * - Ante un 401 renueva UNA vez con la cookie del refresh token (petición compartida
 *   aunque fallen varias a la vez) y repite la llamada; si no se puede, cierra la sesión.
 * - Devuelve `datos` del ApiResponse o lanza ErrorApi.
 */

export type Consulta = Record<string, string | number | boolean | null | undefined>;

/** Rutas de sesión: sin Bearer y su 401 no dispara renovación. */
const RUTAS_SESION = new Set(["/auth/login", "/auth/refresh", "/auth/logout"]);
/** Cabecera exigida por /auth/refresh y /auth/logout (fuerza preflight CORS: otro sitio no puede usar la cookie). */
const CABECERA_AJAX = { "X-Requested-With": "XMLHttpRequest" };

let renovacion: Promise<boolean> | null = null;

function url(ruta: string, consulta?: Consulta): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(consulta ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return `${ENTORNO.apiBase}${ruta}${s ? `?${s}` : ""}`;
}

async function enviar(metodo: string, ruta: string, cuerpo?: unknown, consulta?: Consulta, signal?: AbortSignal, acepta = "application/json"): Promise<Response> {
  const esSesion = RUTAS_SESION.has(ruta);
  const cabeceras: Record<string, string> = { Accept: acepta };
  if (esSesion || ruta === "/auth/contrasena") Object.assign(cabeceras, CABECERA_AJAX);
  if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";
  const sesion = almacen.leerSesion();
  if (sesion && !esSesion) cabeceras.Authorization = `Bearer ${sesion.token}`;
  try {
    return await fetch(url(ruta, consulta), {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      credentials: "same-origin",
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ErrorApi(0, "Sin conexión con el servidor.");
  }
}

async function aError(r: Response): Promise<ErrorApi> {
  const id = r.headers.get("X-Request-Id");
  try {
    const c = (await r.json()) as Partial<ApiErrorCuerpo>;
    return new ErrorApi(r.status, c.mensaje ?? `Error ${r.status}.`, c.campos ?? {}, id);
  } catch {
    const msg = r.status >= 502 ? "No se pudo conectar con el servidor." : `Error ${r.status}.`;
    return new ErrorApi(r.status, msg, {}, id);
  }
}

/** Renueva el access token con la cookie (sin contraseña). Nunca lanza: true si se renovó. */
export function renovar(): Promise<boolean> {
  renovacion ??= enviar("POST", "/auth/refresh")
    .then(async (r) => {
      if (!r.ok) return false;
      almacen.iniciar(((await r.json()) as ApiResponse<Sesion>).datos);
      return true;
    })
    .catch(() => false)
    .finally(() => (renovacion = null));
  return renovacion;
}

interface Opciones {
  consulta?: Consulta;
  cuerpo?: unknown;
  signal?: AbortSignal;
  acepta?: string;
}

/** Envía con renovación ante 401; devuelve la respuesta correcta o lanza ErrorApi. */
async function ejecutar(metodo: string, ruta: string, { consulta, cuerpo, signal, acepta }: Opciones = {}): Promise<Response> {
  let r = await enviar(metodo, ruta, cuerpo, consulta, signal, acepta);
  if (r.status === 401 && !RUTAS_SESION.has(ruta) && ruta !== "/auth/contrasena") {
    const sesion = almacen.leerSesion();
    if (sesion) {
      const vigente = new Date(sesion.expiraEn).getTime() > Date.now();
      if (await renovar()) {
        r = await enviar(metodo, ruta, cuerpo, consulta, signal, acepta);
      } else {
        almacen.terminar(vigente ? "revocada" : "expirada");
      }
    }
  }
  if (!r.ok) throw await aError(r);
  return r;
}

async function solicitar<T>(metodo: string, ruta: string, opciones: Opciones = {}): Promise<T> {
  const r = await ejecutar(metodo, ruta, opciones);
  if (r.status === 204) return undefined as T;
  return ((await r.json()) as ApiResponse<T>).datos;
}

/** Archivo descargado: contenido y nombre sugerido por el servidor (Content-Disposition). */
export interface Descarga {
  contenido: Blob;
  nombre: string | null;
}

async function descargar(ruta: string, consulta?: Consulta): Promise<Descarga> {
  const r = await ejecutar("GET", ruta, { consulta, acepta: "text/csv, application/octet-stream, */*" });
  const disposicion = r.headers.get("Content-Disposition") ?? "";
  const nombre = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposicion)?.[1] ?? null;
  return { contenido: await r.blob(), nombre: nombre ? decodeURIComponent(nombre) : null };
}

/** Verbos HTTP. Las APIs de cada módulo usan solo esto (nunca fetch directo). */
export const http = {
  get: <T>(ruta: string, consulta?: Consulta, signal?: AbortSignal) => solicitar<T>("GET", ruta, { consulta, signal }),
  post: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>("POST", ruta, { cuerpo: cuerpo ?? {} }),
  put: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>("PUT", ruta, { cuerpo: cuerpo ?? {} }),
  patch: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>("PATCH", ruta, { cuerpo: cuerpo ?? {} }),
  delete: <T>(ruta: string) => solicitar<T>("DELETE", ruta),
  /** Descarga binaria (CSV, etc.) con la misma sesión que el resto de llamadas. */
  descargar,
};

/** Solo para pruebas. */
export function _reiniciarRenovacion(): void {
  renovacion = null;
}

/** Envío sin manejo de sesión (lo usa autenticacion.ts para logout). */
export const _enviar = enviar;
