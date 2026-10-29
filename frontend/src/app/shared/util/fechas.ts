const RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/**
 * Convierte a Date un instante del backend. Con `utc`, un valor sin zona
 * (LocalDateTime) se interpreta como UTC, como guarda la bitácora.
 */
export function aFecha(valor: string | Date | null | undefined, utc = false): Date | null {
  if (!valor) {
    return null;
  }
  if (valor instanceof Date) {
    return valor;
  }
  const conZona = utc && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(valor) ? `${valor}Z` : valor;
  const fecha = new Date(conZona);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** "hace 3 días", "en 2 minutos", "ahora". */
export function fechaRelativa(valor: string | Date | null | undefined, utc = false, ahora = Date.now()): string {
  const fecha = aFecha(valor, utc);
  if (!fecha) {
    return '—';
  }
  const segundos = Math.round((fecha.getTime() - ahora) / 1000);
  for (const [unidad, tamano] of UNIDADES) {
    if (Math.abs(segundos) >= tamano) {
      return RELATIVO.format(Math.round(segundos / tamano), unidad);
    }
  }
  return 'ahora';
}

/** Zona horaria del navegador como "UTC−5". */
export function zonaHoraria(fecha = new Date()): string {
  const minutos = -fecha.getTimezoneOffset();
  const signo = minutos >= 0 ? '+' : '−';
  const horas = Math.floor(Math.abs(minutos) / 60);
  const resto = Math.abs(minutos) % 60;
  return `UTC${signo}${horas}${resto ? ':' + String(resto).padStart(2, '0') : ''}`;
}

/** Fecha local en formato ISO sin zona (yyyy-MM-ddTHH:mm:ss) para los filtros del backend en UTC. */
export function isoUtc(fecha: Date): string {
  return fecha.toISOString().slice(0, 19);
}
