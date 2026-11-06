import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { RESULTADOS_AUDITORIA, actorDeEvento, etiquetaAccion, objetivoDeEvento } from '../../../core/config/auditoria';
import { urlModuloPorId } from '../../../paneles/registro';
import { mensajeDeError } from '../../../core/errors/error.util';
import { AuditoriaEvento, FiltroAuditoria } from '../../../core/models';
import { AuditoriaApi } from '../../../core/services/auditoria.api';
import { FechaHoraPipe } from '../../pipes/fecha-hora.pipe';
import { Icon } from '../icon/icon';

/**
 * Últimos eventos de auditoría de un registro (relacionadoCon=TIPO:id) o de
 * un actor, en formato de línea de tiempo, con enlace a la bitácora completa.
 */
@Component({
  selector: 'ui-historial',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, FechaHoraPipe],
  template: `
    @if (actorId() !== null) {
      <div class="ui-chips historial__modo" role="group" aria-label="Qué eventos mostrar">
        <button type="button" class="ui-chip" [attr.aria-pressed]="modo() === 'sobre'" (click)="cambiarModo('sobre')">Sobre este registro</button>
        <button type="button" class="ui-chip" [attr.aria-pressed]="modo() === 'actor'" (click)="cambiarModo('actor')">Acciones realizadas</button>
      </div>
    }

    @if (cargando()) {
      <div class="skeleton-filas" aria-busy="true">
        <span class="u-sr-only">Cargando historial…</span>
        @for (fila of [1, 2, 3, 4]; track fila) { <span class="ui-skeleton"></span> }
      </div>
    } @else if (error()) {
      <p class="historial__vacio">No se pudo cargar el historial. {{ error() }}</p>
      <button type="button" class="ui-btn ui-btn--secondary ui-btn--sm" (click)="cargar()">
        <ui-icon name="refresh" [size]="16" /> Reintentar
      </button>
    } @else if (eventos().length === 0) {
      <p class="historial__vacio">Aún no hay eventos registrados.</p>
    } @else {
      <ol class="historial">
        @for (evento of eventos(); track evento.id) {
          <li class="historial__item">
            <span class="historial__marca" [class]="'historial__marca--' + tono(evento.resultado)" aria-hidden="true"></span>
            <div>
              <p class="historial__accion">
                {{ etiquetaAccion(evento.accion) }}
                @if (evento.resultado !== 'EXITO') {
                  <span class="ui-badge" [class]="'ui-badge--' + tono(evento.resultado)">{{ resultado(evento.resultado) }}</span>
                }
              </p>
              <p class="historial__meta">
                <time [attr.datetime]="evento.ocurridoEn" [title]="evento.ocurridoEn | fechaHora: 'completa' : true">
                  {{ evento.ocurridoEn | fechaHora: 'relativa' : true }}
                </time>
                · {{ modo() === 'actor' ? objetivo(evento) : actor(evento) }}
              </p>
            </div>
          </li>
        }
      </ol>
    }
    <a class="historial__todo" [routerLink]="rutaAuditoria" [queryParams]="filtroEnlace()">
      Ver todo en Auditoría <ui-icon name="chevronRight" [size]="14" />
    </a>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-3); }
    .historial { display: flex; flex-direction: column; gap: var(--space-3); }
    .historial__item { display: grid; grid-template-columns: 12px 1fr; gap: var(--space-3); }
    .historial__marca { width: 10px; height: 10px; margin-top: 6px; border-radius: 50%; background: var(--success); }
    .historial__marca--warning { background: var(--warning); }
    .historial__marca--danger { background: var(--danger); }
    .historial__accion { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); font-weight: 600; font-size: var(--fs-sm); color: var(--text); }
    .historial__meta { font-size: var(--fs-xs); color: var(--text-2); }
    .historial__vacio { font-size: var(--fs-sm); color: var(--text-2); }
    .historial__todo { display: inline-flex; align-items: center; gap: var(--space-1); font-weight: 600; font-size: var(--fs-sm); }
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
