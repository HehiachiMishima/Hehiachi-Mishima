import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { modulosAccesibles, panelesAccesibles, urlModulo, urlPanel } from '../../paneles/registro';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';
import { PageHeader } from '../../shared/ui/page-header/page-header';

/**
 * Selector de paneles: una tarjeta plana por panel accesible, con sus módulos como
 * accesos directos. Solo se ve lo que los permisos del usuario habilitan.
 */
@Component({
  selector: 'app-selector-paneles',
  imports: [RouterLink, Icon, Button, PageHeader],
  template: `
    <app-page-header [eyebrow]="'Portal · ' + fechaHoy" [heading]="saludo + (nombre() ? ', ' + nombre() : '')">
      <ng-container pageMeta>
        <span>Entra a un panel o salta directo a uno de sus módulos.</span>
        <span>
          {{ paneles().length }} {{ paneles().length === 1 ? 'panel' : 'paneles' }} ·
          {{ totalModulos() }} {{ totalModulos() === 1 ? 'módulo' : 'módulos' }}
        </span>
      </ng-container>
    </app-page-header>

    <section class="seccion" aria-labelledby="titulo-paneles">
      <h2 id="titulo-paneles">{{ paneles().length === 1 ? 'Tu panel' : 'Tus paneles' }}</h2>
      <ul class="paneles">
        @for (item of paneles(); track item.panel.id) {
          <li>
            <article class="panel-card" [attr.aria-labelledby]="'panel-' + item.panel.id">
              <header class="panel-card__cabecera">
                <span class="panel-card__mark" aria-hidden="true"><ui-icon [name]="item.panel.icono" [size]="20" /></span>
                <div class="panel-card__titulos">
                  <span class="panel-card__eyebrow">Panel</span>
                  <h3 [id]="'panel-' + item.panel.id">{{ item.panel.nombre }}</h3>
                </div>
              </header>
              <p class="panel-card__desc">{{ item.panel.descripcion }}</p>

              <div>
                <p class="panel-card__lista-titulo" [id]="'mods-' + item.panel.id">
                  Módulos <span class="contador">{{ item.modulos.length }}</span>
                </p>
                <ul class="modulos" [attr.aria-labelledby]="'mods-' + item.panel.id">
                  @for (modulo of item.modulos; track modulo.id) {
                    <li>
                      <a [routerLink]="urlModulo(item.panel, modulo)">
                        <ui-icon [name]="modulo.icono" [size]="16" />
                        <span class="modulos__nombre">{{ modulo.nombre }}</span>
                        <ui-icon class="modulos__ir" name="chevronRight" [size]="16" />
                      </a>
                    </li>
                  }
                </ul>
              </div>

              <a appButton variant="secondary" size="sm" class="panel-card__cta" [routerLink]="urlPanel(item.panel)">
                Entrar al panel <ui-icon name="chevronRight" [size]="16" />
              </a>
            </article>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    @use 'design' as d;

    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
    }

    .seccion {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: d.space('6');
      padding-top: d.space('8');
    }

    .paneles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
      gap: d.space('6');
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .panel-card {
      @include d.entity-card(true);
      align-content: start;
      height: 100%;
      padding: d.space('6');
    }

    .panel-card__cabecera {
      display: flex;
      align-items: center;
      gap: d.space('3');
    }

    .panel-card__mark {
      display: inline-grid;
      flex-shrink: 0;
      place-items: center;
      width: d.layout('control-height');
      height: d.layout('control-height');
      border: 1px solid d.color('border');
      color: d.color('text-strong');
    }

    .panel-card__titulos {
      display: grid;
      min-width: 0;
    }

    .panel-card__eyebrow {
      @include d.eyebrow;
    }

    .panel-card__desc {
      @include d.type('body-01');
      @include d.line-clamp(2);
      color: d.color('text-muted');
    }

    .panel-card__lista-titulo {
      display: flex;
      align-items: center;
      gap: d.space('2');
      padding-bottom: d.space('2');
      border-bottom: 1px solid d.color('border-strong');
      @include d.type('mono-00-caps');
      color: d.color('text');
    }

    .contador {
      display: inline-grid;
      place-items: center;
      min-width: 1.25rem;
      height: 1.25rem;
      padding: 0 d.space('2');
      background: d.color('neutral-soft');
      @include d.type('label-00');
      text-transform: none;
    }

    .modulos {
      display: grid;
      margin: 0;
      padding: 0;
      list-style: none;

      li + li {
        border-top: 1px solid d.color('border');
      }

      a {
        display: flex;
        align-items: center;
        gap: d.space('2');
        min-height: d.layout('nav-item-height');
        padding: d.space('1') d.space('2');
        @include d.type('interface-01');
        color: d.color('text');
        @include d.focus-ring(-2px);

        @include d.touch {
          min-height: d.touch-target();
        }

        ui-icon {
          flex-shrink: 0;
          color: d.color('text-faint');
        }

        &:hover {
          background: d.color('surface-hover');
          color: d.color('text-strong');
        }
      }
    }

    .modulos__nombre {
      flex: 1;
      min-width: 0;
      @include d.truncate;
    }

    .panel-card__cta {
      justify-self: start;
    }
  `,
})
export class SelectorPaneles {
  private readonly auth = inject(Auth);
  readonly urlPanel = urlPanel;
  readonly urlModulo = urlModulo;

  private readonly ahora = new Date();
  readonly fechaHoy = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(this.ahora);
  readonly saludo =
    this.ahora.getHours() < 12 ? 'Buenos días' : this.ahora.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';

  readonly nombre = computed(() => this.auth.usuario()?.nombre ?? '');
  readonly paneles = computed(() => {
    const permisos = this.auth.permisos();
    return panelesAccesibles(permisos).map((panel) => ({ panel, modulos: modulosAccesibles(panel, permisos) }));
  });
  readonly totalModulos = computed(() => this.paneles().reduce((total, item) => total + item.modulos.length, 0));
}
