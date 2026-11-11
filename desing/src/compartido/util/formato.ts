import { ENTORNO } from "@/config/entorno";

/** Formatos de presentación compartidos. Se muestran siempre en la zona del navegador. */

/** Desfase (ms) de una zona IANA respecto a UTC en un instante dado. */
function desfase(instante: number, zona: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: zona, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(instante)
      .map((x) => [x.type, Number(x.value)]),
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instante / 1000) * 1000;
}

/**
 * Valor del backend → Date.
 * - Con zona ("…Z", "-05:00"): Instant exacto (bitácora, monitoreo, sesión).
 * - Sin zona: LocalDateTime en la zona del negocio (creadoEn, actualizadoEn de usuarios, roles…).
 */
export function aFecha(valor: string | Date | null | undefined, zona: string = ENTORNO.zonaNegocio): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(valor)) {
    const f = new Date(valor);
    return Number.isNaN(f.getTime()) ? null : f;
  }
  const comoUtc = new Date(`${valor}Z`).getTime();
  if (Number.isNaN(comoUtc)) return null;
  // Dos pasadas: el desfase puede cambiar justo en un cambio de horario.
  const primera = comoUtc - desfase(comoUtc, zona);
  return new Date(comoUtc - desfase(primera, zona));
}

const FECHA_HORA = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });
const HORA = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });
const RELATIVO = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export const fechaHora = (v: string | Date | null | undefined): string => {
  const f = aFecha(v);
  return f ? FECHA_HORA.format(f) : "—";
};

export const hora = (v: string | Date | null | undefined): string => {
  const f = aFecha(v);
  return f ? HORA.format(f) : "—";
};

/** "hace 3 minutos", "ahora". */
export function haceCuanto(v: string | Date | null | undefined, ahora = Date.now()): string {
  const f = aFecha(v);
  if (!f) return "—";
  const s = Math.round((f.getTime() - ahora) / 1000);
  for (const [unidad, tam] of UNIDADES) if (Math.abs(s) >= tam) return RELATIVO.format(Math.round(s / tam), unidad);
  return "ahora";
}

export const numero = (n: number): string => n.toLocaleString("es");

/** "ana" → "@ana"; vacío → "—". */
export const login = (u: string | null | undefined): string => (!u ? "—" : u.startsWith("@") ? u : `@${u}`);

/** Porcentaje entero acotado a 0..100 (0 si total no es positivo). */
export const porcentaje = (parte: number, total: number): number => (total > 0 ? Math.min(100, Math.max(0, Math.round((parte / total) * 100))) : 0);

export function bytes(b: number): string {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let v = b;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString("es", { maximumFractionDigits: v < 10 ? 1 : 0 })} ${u[i]}`;
}

export function duracion(segundos: number): string {
  const d = Math.floor(segundos / 86_400);
  const h = Math.floor((segundos % 86_400) / 3_600);
  const m = Math.floor((segundos % 3_600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

const FECHA_COMPLETA = new Intl.DateTimeFormat("es", { dateStyle: "full", timeStyle: "medium" });
const DIA_HORA = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const MES = new Intl.DateTimeFormat("es", { month: "short", year: "2-digit" });

/** "miércoles, 29 de octubre de 2026, 10:41:03". */
export const fechaCompleta = (v: string | Date | null | undefined): string => {
  const f = aFecha(v);
  return f ? FECHA_COMPLETA.format(f) : "—";
};

/** "29 oct, 10:41:03" (tablas de eventos). */
export const diaHora = (v: string | Date | null | undefined): string => {
  const f = aFecha(v);
  return f ? DIA_HORA.format(f) : "—";
};

/** "2026-03" → "mar 26". */
export function mes(periodo: string): string {
  const [a, m] = periodo.split("-").map(Number);
  return a && m ? MES.format(new Date(a, m - 1, 1)) : periodo;
}

/** Zona del navegador como "UTC−5" (las fechas se muestran en ella). */
export function zonaHoraria(fecha = new Date()): string {
  const min = -fecha.getTimezoneOffset();
  const h = Math.floor(Math.abs(min) / 60);
  const r = Math.abs(min) % 60;
  return `UTC${min >= 0 ? "+" : "−"}${h}${r ? `:${String(r).padStart(2, "0")}` : ""}`;
}

/** Zona IANA del navegador (la API agrupa por día en ella). */
export const zonaIana = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "1 usuario" / "3 usuarios". */
export const plural = (n: number, uno: string, varios: string): string => `${numero(n)} ${n === 1 ? uno : varios}`;
