import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { etiquetaPermiso } from '../../core/config/permisos';
import { Auth } from '../../core/services/auth';
import { PANEL_ACTUAL } from '../../paneles/panel-actual';
import { panelesAccesibles, primerModuloAccesible, urlModulo, urlPanel } from '../../paneles/registro';
import { textoUrl } from '../../shared/util/estado-url';
import { Button } from '../../shared/ui/button/button';
import { Icon } from '../../shared/ui/icon/icon';

@Component({
  selector: 'app-sin-acceso',
  imports: [Icon, Button],
  template: `
    <section class="denegado" aria-labelledby="titulo-denegado">
      <span class="denegado__eyebrow"><ui-icon name="lock" [size]="16" /> Error 403</span>
      <h1 id="titulo-denegado" tabindex="-1">Acceso denegado</h1>
      <p>
        @if (permiso()) {
          Necesitas el permiso <strong>{{ etiqueta() }}</strong> <code>{{ permiso() }}</code>
          para ver este contenido. Solicítalo a un administrador.
        } @else {
          No tienes el permiso requerido para ver este contenido. Solicítalo a un administrador.
        }
      </p>
      <div class="denegado__acciones">
        @if (alternativa(); as destino) {
          <button appButton type="button" (click)="ir(destino.ruta)">
            <ui-icon name="panel" [size]="16" />
            Ir a {{ destino.nombre }}
          </button>
        }
        <button appButton variant="ghost" type="button" (click)="cerrarSesion()">Cerrar sesión</button>
      </div>
    </section>
  `,
  styles: `
    @use 'design' as d;

    .denegado {
      @include d.page-empty;
      display: grid;
      justify-items: start;
      gap: d.space('2');
      padding-inline: 0;

      > p {
        margin-top: d.space('2');
        @include d.type('body-02');
        color: d.color('text-muted');
      }

      strong {
        color: d.color('text-strong');
        font-weight: d.font-weight('semibold');
      }
    }

    .denegado__eyebrow {
      display: inline-flex;
      align-items: center;
      gap: d.space('2');
      @include d.eyebrow;
    }

    h1 {
      @include d.type('heading-05');
    }

    .denegado__acciones {
      display: flex;
      flex-wrap: wrap;
      gap: d.space('2');
      margin-top: d.space('8');
    }
  `,
})
export class SinAcceso {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);

  readonly permiso = input('', { transform: textoUrl });
  readonly etiqueta = computed(() => etiquetaPermiso(this.permiso()));

  private readonly panel = inject(PANEL_ACTUAL, { optional: true });

  /** Salida útil: el primer módulo accesible del panel o, fuera de uno, el primer panel accesible. */
  readonly alternativa = computed(() => {
    const permisos = this.auth.permisos();
    if (this.panel) {
      const modulo = primerModuloAccesible(this.panel, permisos);
      return modulo ? { nombre: modulo.nombre, ruta: urlModulo(this.panel, modulo) } : null;
    }
    const panel = panelesAccesibles(permisos)[0];
    return panel ? { nombre: panel.nombre, ruta: urlPanel(panel) } : null;
  });

  ir(ruta: string): void {
    void this.router.navigateByUrl(ruta);
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
