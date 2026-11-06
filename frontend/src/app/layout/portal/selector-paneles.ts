import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../core/services/auth';
import { modulosAccesibles, panelesAccesibles, urlModulo, urlPanel } from '../../paneles/registro';
import { Icon } from '../../shared/ui/icon/icon';

/**
 * Centro de mando: saludo ejecutivo y una tarjeta de cristal por panel
 * accesible, con sus módulos como mosaico de accesos directos. Con un solo
 * panel la tarjeta es protagonista ("featured"); con varios, rejilla bento.
 */
@Component({
  selector: 'app-selector-paneles',
  imports: [RouterLink, Icon],
  template: `
    <section class="mando" [attr.data-paneles]="paneles().length > 2 ? 'varios' : paneles().length">
      <header class="mando__hero">
        <div class="mando__hero-texto">
          <p class="mando__eyebrow">
            <span class="mando__plataforma">Hehiachi Mishima</span>
            <span class="mando__sep" aria-hidden="true"></span>
            <span class="mando__fecha">{{ fechaHoy }}</span>
          </p>
          <h1 class="mando__titulo" tabindex="-1">{{ saludo }}{{ nombre() ? ', ' + nombre() : '' }}</h1>
          <p class="mando__texto">
            Tu centro de mando. Entra a un panel o salta directo a uno de sus módulos; solo ves lo que tus permisos
            habilitan.
          </p>
        </div>
        <dl class="mando__stats">
          <div class="mando__stat">
            <dt>{{ paneles().length === 1 ? 'Panel' : 'Paneles' }}</dt>
            <dd>{{ paneles().length }}</dd>
          </div>
          <div class="mando__stat">
            <dt>Módulos</dt>
            <dd>{{ totalModulos() }}</dd>
          </div>
        </dl>
      </header>

      <h2 class="mando__seccion">{{ paneles().length === 1 ? 'Tu panel' : 'Tus paneles' }}</h2>
      <ul class="mando__paneles">
        @for (item of paneles(); track item.panel.id; let primero = $first) {
          <li class="mando__celda" [class.mando__celda--destacada]="primero">
            <article class="panel-card" [attr.data-tono]="item.panel.tono" [attr.aria-labelledby]="'panel-' + item.panel.id">
              <div class="panel-card__identidad">
                <span class="panel-card__mark" aria-hidden="true"><ui-icon [name]="item.panel.icono" [size]="30" /></span>
                <span class="panel-card__eyebrow">Panel</span>
                <h3 class="panel-card__nombre" [id]="'panel-' + item.panel.id">{{ item.panel.nombre }}</h3>
                <p class="panel-card__desc">{{ item.panel.descripcion }}</p>
                <p class="panel-card__cuenta">
                  <ui-icon name="layers" [size]="14" />
                  {{ item.modulos.length }} {{ item.modulos.length === 1 ? 'módulo disponible' : 'módulos disponibles' }}
                </p>
                <a class="panel-card__cta" [routerLink]="urlPanel(item.panel)">
                  Entrar al panel <ui-icon name="chevronRight" [size]="18" />
                </a>
              </div>
              <div class="panel-card__modulos">
                <p class="panel-card__modulos-titulo" [id]="'mods-' + item.panel.id">Accesos directos</p>
                <ul class="panel-card__mosaico" [attr.aria-labelledby]="'mods-' + item.panel.id">
                  @for (modulo of item.modulos; track modulo.id) {
                    <li>
                      <a class="modulo-tile" [routerLink]="urlModulo(item.panel, modulo)">
                        <span class="modulo-tile__icon" aria-hidden="true"><ui-icon [name]="modulo.icono" [size]="20" /></span>
                        <span class="modulo-tile__texto">
                          <span class="modulo-tile__nombre">{{ modulo.nombre }}</span>
                          <span class="modulo-tile__desc">{{ modulo.descripcion }}</span>
                        </span>
                        <ui-icon class="modulo-tile__ir" name="chevronRight" [size]="16" />
                      </a>
                    </li>
                  }
                </ul>
              </div>
            </article>
          </li>
        }
      </ul>
    </section>
  `,
  styleUrl: './selector-paneles.scss',
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
