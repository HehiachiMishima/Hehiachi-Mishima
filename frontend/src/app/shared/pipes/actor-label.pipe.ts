import { Pipe, PipeTransform, inject } from '@angular/core';
import { DirectorioUsuarios } from '../../core/services/directorio-usuarios';
import { formatearLogin } from '../util/formato';

/**
 * Etiqueta legible de un actor (creado_por, actualizado_por, auditoría).
 * 0 = sistema; null = sin dato. Resuelve el login real con el directorio y es
 * impura para recalcular cuando el directorio termina de cargar.
 */
@Pipe({ name: 'actorLabel', pure: false })
export class ActorLabelPipe implements PipeTransform {
  private readonly directorio = inject(DirectorioUsuarios);

  transform(valor: number | null | undefined, respaldo?: string | null): string {
    if (valor === null || valor === undefined) {
      return respaldo ? formatearLogin(respaldo) : '—';
    }
    if (valor === 0) {
      return 'Sistema';
    }
    const nombre = this.directorio.nombre(valor) ?? respaldo;
    return nombre ? formatearLogin(nombre) : `Usuario #${valor}`;
  }
}
