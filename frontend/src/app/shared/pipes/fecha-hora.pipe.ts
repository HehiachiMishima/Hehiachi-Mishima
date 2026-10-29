import { Pipe, PipeTransform } from '@angular/core';
import { aFecha, fechaRelativa, zonaHoraria } from '../util/fechas';

const FORMATO = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const FORMATO_COMPLETO = new Intl.DateTimeFormat('es', {
  dateStyle: 'full',
  timeStyle: 'medium',
});

type Modo = 'corta' | 'completa' | 'relativa';

/**
 * Fecha y hora con la zona visible: "29/10/2026, 14:05 (UTC−5)".
 * `utc` interpreta valores sin zona como UTC (bitácora de auditoría).
 */
@Pipe({ name: 'fechaHora' })
export class FechaHoraPipe implements PipeTransform {
  transform(valor: string | Date | null | undefined, modo: Modo = 'corta', utc = false): string {
    const fecha = aFecha(valor, utc);
    if (!fecha) {
      return '—';
    }
    if (modo === 'relativa') {
      return fechaRelativa(fecha);
    }
    const texto = (modo === 'completa' ? FORMATO_COMPLETO : FORMATO).format(fecha);
    return `${texto} (${zonaHoraria(fecha)})`;
  }
}
