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
};

export interface RangoUrl {
  rango?: string | null;
  desde?: string | null;
  hasta?: string | null;
}

/** URL → valor del DateRangePicker (por defecto el relativo indicado). */
export function rangoDesdeUrl(u: RangoUrl, porDefecto = "7d"): DateRangePickerProps.Value {
  if (u.desde || u.hasta) return { type: "absolute", startDate: u.desde ?? "", endDate: u.hasta ?? "" };
  return RANGOS_RELATIVOS.find((r) => r.key === u.rango) ?? RANGOS_RELATIVOS.find((r) => r.key === porDefecto)!;
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
  minute: ["minuto", "minutos"],
  hour: ["hora", "horas"],
  day: ["día", "días"],
  week: ["semana", "semanas"],
};

/** Texto de un periodo relativo: "Últimas 24 horas", "Últimos 7 días". */
export function textoRango(v: DateRangePickerProps.RelativeValue): string {
  const [uno, varios] = UNIDADES[v.unit] ?? [v.unit, v.unit];
  if (v.amount === 1) return v.unit === "hour" ? "Última hora" : v.unit === "week" ? "Última semana" : `Último ${uno}`;
  const femenino = v.unit === "hour" || v.unit === "week";
  return `${femenino ? "Últimas" : "Últimos"} ${v.amount} ${varios}`;
}

export const validarRango: DateRangePickerProps.ValidationFunction = (v) => {
  if (v?.type === "absolute") {
    if (!v.startDate || !v.endDate) return { valid: false, errorMessage: "Indica el inicio y el fin del periodo." };
    if (new Date(v.startDate) > new Date(v.endDate)) return { valid: false, errorMessage: "El inicio debe ser anterior al fin." };
  }
  return { valid: true };
};
