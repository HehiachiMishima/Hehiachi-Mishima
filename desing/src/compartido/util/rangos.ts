import type { DateRangePickerProps } from "@cloudscape-design/components/date-range-picker";

/**
 * Periodos relativos de las bitácoras y su conversión a desde/hasta. El estado viaja en la URL
 * como `rango=24h` o como `desde`/`hasta` ISO (enlaces compartibles).
 */
export const RANGOS_RELATIVOS: DateRangePickerProps.RelativeOption[] = [
  { key: "1h", amount: 1, unit: "hour", type: "relative" },
  { key: "24h", amount: 24, unit: "hour", type: "relative" },
  { key: "7d", amount: 7, unit: "day", type: "relative" },
  { key: "30d", amount: 30, unit: "day", type: "relative" },
];

const MS: Partial<Record<DateRangePickerProps.TimeUnit, number>> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
  year: 365 * 86_400_000,
};

const UNIDADES_URL = /^(\d+)(second|minute|hour|day|week|month|year)$/;

export interface RangoUrl {
  rango?: string | null;
  desde?: string | null;
  hasta?: string | null;
}

/** URL → valor del DateRangePicker (por defecto el relativo indicado). */
export function rangoDesdeUrl(u: RangoUrl, porDefecto = "7d"): DateRangePickerProps.Value {
  if (u.desde || u.hasta) return { type: "absolute", startDate: u.desde ?? "", endDate: u.hasta ?? "" };
  const conocido = RANGOS_RELATIVOS.find((r) => r.key === u.rango);
  if (conocido) return conocido;
  // Periodo personalizado del selector ("3day", "90minute"…): se conserva tal cual.
  const m = UNIDADES_URL.exec(u.rango ?? "");
  if (m && Number(m[1]) > 0) return { type: "relative", amount: Number(m[1]), unit: m[2] as DateRangePickerProps.TimeUnit };
  return RANGOS_RELATIVOS.find((r) => r.key === porDefecto)!;
}

/** Valor del DateRangePicker → parámetros de URL. */
export function rangoAUrl(v: DateRangePickerProps.Value | null): RangoUrl {
  if (!v) return { rango: null, desde: null, hasta: null };
  if (v.type === "absolute") return { rango: null, desde: v.startDate, hasta: v.endDate };
  const conocido = RANGOS_RELATIVOS.find((r) => r.amount === v.amount && r.unit === v.unit);
  return { rango: conocido?.key ?? `${v.amount}${v.unit}`, desde: null, hasta: null };
}

/** Valor → instantes ISO para la API. Los relativos se anclan a `ancla` (paginación estable). */
export function rangoAInstantes(v: DateRangePickerProps.Value, ancla: number): { desde?: string; hasta?: string } {
  if (v.type === "absolute") {
    return { desde: v.startDate ? new Date(v.startDate).toISOString() : undefined, hasta: v.endDate ? new Date(v.endDate).toISOString() : undefined };
  }
  const ms = (MS[v.unit] ?? MS.day!) * v.amount;
  return { desde: new Date(ancla - ms).toISOString(), hasta: new Date(ancla).toISOString() };
}

const UNIDADES: Partial<Record<DateRangePickerProps.TimeUnit, [string, string]>> = {
  second: ["segundo", "segundos"],
  minute: ["minuto", "minutos"],
  hour: ["hora", "horas"],
  day: ["día", "días"],
  week: ["semana", "semanas"],
  month: ["mes", "meses"],
  year: ["año", "años"],
};

/** Texto de un periodo relativo: "Últimas 24 horas", "Últimos 7 días". */
export function textoRango(v: DateRangePickerProps.RelativeValue): string {
  const [uno, varios] = UNIDADES[v.unit] ?? [v.unit, v.unit];
  const femenino = v.unit === "hour" || v.unit === "week";
  if (v.amount === 1) return `${femenino ? "Última" : "Último"} ${uno}`;
  return `${femenino ? "Últimas" : "Últimos"} ${v.amount} ${varios}`;
}

export const validarRango: DateRangePickerProps.ValidationFunction = (v) => {
  if (v?.type === "absolute") {
    if (!v.startDate || !v.endDate) return { valid: false, errorMessage: "Indica el inicio y el fin del periodo." };
    if (new Date(v.startDate) > new Date(v.endDate)) return { valid: false, errorMessage: "El inicio debe ser anterior al fin." };
  }
  return { valid: true };
};
