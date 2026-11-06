import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { RESULTADOS_AUDITORIA, actorDeEvento, etiquetaAccion, objetivoDeEvento } from '../../../core/config/auditoria';
import { urlModuloPorId } from '../../../paneles/registro';
import { mensajeDeError } from '../../../core/errors/error.util';
import { AuditoriaEvento, FiltroAuditoria } from '../../../core/models';
import { AuditoriaApi } from '../../../core/services/auditoria.api';
import { FechaHoraPipe } from '../../pipes/fecha-hora.pipe';
import { Badge } from '../badge/badge';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import { Notice } from '../notice/notice';
import { Segmented, SegmentedOption } from '../segmented/segmented';

/**
 * Últimos eventos de auditoría de un registro (relacionadoCon=TIPO:id) o de
 * un actor, en formato de línea de tiempo, con enlace a la bitácora completa.
 */
@Component({
  selector: 'ui-historial',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, FechaHoraPipe, Badge, Button, Notice, Segmented],
  template: `
    @if (actorId() !== null) {
      <app-segmented class="historial__modo" label="Qué eventos mostrar" [options]="modos" [value]="modo()"
        (valueChange)="cambiarModo($event)" />
    }
    @if (cargando()) {
      <div class="skeleton-filas" aria-busy="true">
        <span class="u-sr-only">Cargando historial…</span>
        @for (fila of [1, 2, 3, 4]; track fila) { <span class="ui-skeleton"></span> }
      </div>
    } @else if (error()) {
      <app-notice tone="danger">No se pudo cargar el historial. {{ error() }}</app-notice>
      <button appButton variant="secondary" size="sm" type="button" (click)="cargar()">
        <ui-icon name="refresh" [size]="16" /> Reintentar
      </button>
    } @else if (eventos().length === 0) {
      <p class="historial__vacio">Aún no hay eventos registrados.</p>
    } @else {
      <ol class="historial">
        @for (evento of eventos(); track evento.id) {
          <li>
            <ui-icon class="historial__icono" [class]="'historial__icono--' + tono(evento.resultado)"
              [name]="evento.resultado === 'EXITO' ? 'checkCircleFilled' : evento.resultado === 'DENEGADO' ? 'lock' : 'alertTriangle'"
              [size]="16" />
            <div class="historial__texto">
              <p class="historial__accion">
                {{ etiquetaAccion(evento.accion) }}
                @if (evento.resultado !== 'EXITO') {
                  <app-badge [tone]="$any(tono(evento.resultado))">{{ resultado(evento.resultado) }}</app-badge>
                }
              </p>
              <p class="historial__meta">{{ modo() === 'actor' ? objetivo(evento) : actor(evento) }}</p>
              <time [attr.datetime]="evento.ocurridoEn" [title]="evento.ocurridoEn | fechaHora: 'completa' : true">
                {{ evento.ocurridoEn | fechaHora: 'relativa' : true }}
              </time>
            </div>
          </li>
        }
      </ol>
    }
    <a appButton variant="tertiary" size="sm" class="historial__todo" [routerLink]="rutaAuditoria" [queryParams]="filtroEnlace()">
      Ver todo en Auditoría <ui-icon name="chevronRight" [size]="16" />
    </a>
  `,
  styles: `
    @use 'design' as d;

    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      justify-items: start;
      gap: d.space('4');
    }

    .historial {
      @include d.timeline;
      width: 100%;
    }

    .historial__icono {
      margin-top: 2px;
      color: d.color('text-faint');
    }

    .historial__icono--success {
      color: d.color('success');
    }

    .historial__icono--warning {
      color: d.color('warning');
    }

    .historial__icono--danger {
      color: d.color('danger');
    }

    .historial__texto {
      min-width: 0;
    }

    .historial__accion {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: d.space('2');
      @include d.type('body-01-medium');
      color: d.color('text-strong');
    }

    .historial__meta {
      margin-top: 2px;
      @include d.type('body-01');
      color: d.color('text-muted');
      overflow-wrap: anywhere;
    }

    .historial__vacio {
      @include d.type('body-01');
      color: d.color('text-muted');
    }
  `,
})
export class Historial {
  private readonly auditoriaApi = inject(AuditoriaApi);

  /** TIPO:id del registro, p. ej. "USUARIO:42" o "ROL:7". */
  readonly relacionadoCon = input.required<string>();
  /** Si se indica, permite alternar a las acciones realizadas por ese usuario. */
  readonly actorId = input<number | null>(null);
  readonly limite = input(20);

  readonly rutaAuditoria = urlModuloPorId('auditoria');
  readonly modo = signal<'sobre' | 'actor'>('sobre');
  readonly modos: readonly SegmentedOption<'sobre' | 'actor'>[] = [
    { value: 'sobre', label: 'Sobre este registro' },
    { value: 'actor', label: 'Acciones realizadas' },
  ];
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly eventos = signal<AuditoriaEvento[]>([]);

  readonly etiquetaAccion = etiquetaAccion;
  readonly actor = actorDeEvento;
  readonly objetivo = objetivoDeEvento;

  constructor() {
    effect(() => {
      this.relacionadoCon();
      untracked(() => {
        this.modo.set('sobre');
        this.cargar();
      });
    });
  }

  filtroEnlace(): FiltroAuditoria {
    const actorId = this.actorId();
    return this.modo() === 'actor' && actorId !== null ? { actorId } : { relacionadoCon: this.relacionadoCon() };
  }

  cambiarModo(modo: 'sobre' | 'actor'): void {
    if (modo !== this.modo()) {
      this.modo.set(modo);
      this.cargar();
    }
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.auditoriaApi
      .buscar({ ...this.filtroEnlace(), pagina: 1, tamano: this.limite() })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (pagina) => this.eventos.set(pagina.contenido ?? []),
        error: (err: unknown) => this.error.set(mensajeDeError(err)),
      });
  }

  tono(resultado: string): string {
    return RESULTADOS_AUDITORIA[resultado]?.tono ?? 'neutral';
  }

  resultado(resultado: string): string {
    return RESULTADOS_AUDITORIA[resultado]?.etiqueta ?? resultado;
  }
}
