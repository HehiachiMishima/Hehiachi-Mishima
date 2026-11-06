import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Carga } from '../../../core/services/carga';

@Component({
  selector: 'ui-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // El texto lo anuncia Carga mediante el Anunciador; la capa es solo visual.
  template: `
    @if (carga.visible()) {
      <div class="loader" aria-hidden="true">
        <div class="loader__box">
          <span class="loader__barra"></span>
          <p class="loader__text">{{ carga.texto() }}</p>
        </div>
      </div>
    }
  `,
  styles: `
    @use 'design' as d;

    :host {
      display: contents;
    }

    .loader {
      position: fixed;
      inset: 0;
      z-index: d.z('toast');
      display: grid;
      place-items: center;
      background: d.color('overlay');

      @include d.motion-safe {
        animation: loader-fade d.motion('normal') d.motion('easing') both;
      }
    }

    .loader__box {
      display: grid;
      gap: d.space('3');
      width: min(20rem, calc(100vw - #{d.space('8')}));
      padding: d.space('6');
      background: d.color('surface');
      border: 1px solid d.color('border');
      box-shadow: d.shadow('lg');
    }

    // Progreso indeterminado de 2 px, sin radio.
    .loader__barra {
      position: relative;
      height: 2px;
      overflow: hidden;
      background: d.color('progress-track');

      &::after {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 40%;
        background: d.color('progress-fill');
        animation: loader-avance 1.1s ease-in-out infinite;
      }
    }

    .loader__text {
      @include d.type('body-01');
      color: d.color('text');
    }

    @keyframes loader-fade {
      from {
        opacity: 0;
      }
    }

    @keyframes loader-avance {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(250%);
      }
    }
  `,
})
export class Loader {
  protected readonly carga = inject(Carga);
}
