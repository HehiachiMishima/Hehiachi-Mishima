import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Icon } from '../icon/icon';

export type AnchoModal = 'sm' | 'md' | 'lg';

const ENFOCABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let secuencia = 0;

/**
 * Diálogo modal accesible: trampa de foco, Escape, retorno de foco y nombre
 * y descripción por aria-labelledby / aria-describedby. `lateral` lo muestra
 * como panel de detalle anclado a la derecha (pantalla completa en móvil).
 */
@Component({
  selector: 'ui-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: {
    '(document:keydown)': 'alTecla($event)',
  },
  template: `
    @if (abierto()) {
      <div class="ui-modal-backdrop" [class.ui-modal-backdrop--lateral]="lateral()" (click)="alClicFondo($event)">
        <section
          #dialogo
          class="ui-modal"
          [class]="'ui-modal--' + ancho()"
          [class.ui-modal--compacto]="compacto()"
          [class.ui-modal--lateral]="lateral()"
          [attr.role]="alerta() ? 'alertdialog' : 'dialog'"
          aria-modal="true"
          tabindex="-1"
          [attr.aria-labelledby]="idBase + '-titulo'"
          [attr.aria-describedby]="subtitulo() ? idBase + '-sub' : null"
        >
          <header class="ui-modal__header">
            <div class="ui-modal__heading">
              <h2 class="ui-modal__title" [id]="idBase + '-titulo'">{{ titulo() }}</h2>
              @if (subtitulo()) {
                <p class="ui-modal__subtitle" [id]="idBase + '-sub'">{{ subtitulo() }}</p>
              }
            </div>
            <button type="button" class="ui-icon-btn" (click)="cerrar.emit()" [attr.aria-label]="'Cerrar: ' + titulo()">
              <ui-icon name="close" [size]="18" />
            </button>
          </header>

          <div class="ui-modal__body">
            <ng-content />
          </div>

          <div class="ui-modal__footer">
            <ng-content select="[modal-footer]" />
          </div>
        </section>
      </div>
    }
  `,
})
export class Modal {
  private readonly caja = viewChild<ElementRef<HTMLElement>>('dialogo');
  private focoPrevio: HTMLElement | null = null;

  readonly idBase = `ui-modal-${++secuencia}`;

  readonly abierto = input(false);
  readonly titulo = input('');
  readonly subtitulo = input('');
  readonly ancho = input<AnchoModal>('md');
  readonly compacto = input(false);
  readonly lateral = input(false);
  /** Diálogo de confirmación o aviso que exige respuesta (role="alertdialog"). */
  readonly alerta = input(false);
  readonly cerrar = output<void>();

  constructor() {
    effect(() => {
      const caja = this.caja();
      if (caja && this.focoPrevio === null) {
        this.focoPrevio = (document.activeElement as HTMLElement | null) ?? document.body;
        this.enfocarPrimero(caja.nativeElement);
      } else if (!caja && this.focoPrevio !== null) {
        // Si el disparador ya no existe (fila eliminada), el foco va al título de la página.
        const destino = this.focoPrevio.isConnected
          ? this.focoPrevio
          : document.querySelector<HTMLElement>('#contenido h1, #contenido');
        destino?.focus();
        this.focoPrevio = null;
      }
    });
  }

  alClicFondo(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.cerrar.emit();
    }
  }

  alTecla(evento: KeyboardEvent): void {
    const caja = this.caja();
    if (!caja) {
      return;
    }
    // Con modales apilados solo responde el último abierto.
    const dialogos = document.querySelectorAll('.ui-modal');
    if (dialogos[dialogos.length - 1] !== caja.nativeElement) {
      return;
    }
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.cerrar.emit();
      return;
    }
    if (evento.key === 'Tab') {
      this.atraparFoco(evento, caja.nativeElement);
    }
  }

  /** Foco inicial: [data-autofocus] (p. ej. "Cancelar" en confirmaciones), luego el cuerpo. */
  private enfocarPrimero(raiz: HTMLElement): void {
    const preferido = raiz.querySelector<HTMLElement>('[data-autofocus]');
    const cuerpo = raiz.querySelector<HTMLElement>('.ui-modal__body');
    const enCuerpo = cuerpo ? this.enfocables(cuerpo)[0] : undefined;
    (preferido ?? enCuerpo ?? this.enfocables(raiz)[0] ?? raiz).focus();
  }

  private atraparFoco(evento: KeyboardEvent, raiz: HTMLElement): void {
    const lista = this.enfocables(raiz);
    if (lista.length === 0) {
      evento.preventDefault();
      raiz.focus();
      return;
    }
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    const activo = document.activeElement;
    if (evento.shiftKey && (activo === primero || activo === raiz)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  private enfocables(raiz: HTMLElement): HTMLElement[] {
    return Array.from(raiz.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(
      (el) => el.getClientRects().length > 0,
    );
  }
}
