import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { panelesAccesibles, primerModuloAccesible } from '../../core/config/paneles';
import { etiquetaPermiso } from '../../core/config/permisos';
import { Auth } from '../../core/services/auth';
import { textoUrl } from '../../shared/util/estado-url';
import { Icon } from '../../shared/ui/icon/icon';

@Component({
  selector: 'app-sin-acceso',
  imports: [Icon],
  template: `
    <main id="contenido" class="denied" tabindex="-1">
      <div class="denied__card">
        <span class="denied__icon" aria-hidden="true"><ui-icon name="lock" [size]="30" /></span>
        <h1 class="denied__title">Acceso denegado</h1>
        <p class="denied__text">
          @if (permiso()) {
            Necesitas el permiso <strong>{{ etiqueta() }}</strong>
            <span class="denied__permiso">{{ permiso() }}</span>
            para ver este contenido. Solicítalo a un administrador.
          } @else {
            No tienes el permiso requerido para ver este contenido. Solicítalo a un administrador.
          }
        </p>
        <div class="denied__actions">
          @if (alternativa(); as destino) {
            <button type="button" class="ui-btn ui-btn--primary" (click)="ir(destino.ruta)">
              <ui-icon name="panel" [size]="18" />
              Ir a {{ destino.nombre }}
            </button>
          }
          <button type="button" class="ui-btn ui-btn--ghost" (click)="cerrarSesion()">Cerrar sesión</button>
        </div>
      </div>
    </main>
  `,
  styles: `
    .denied {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-6);
      background: var(--bg);
    }
    .denied__card {
      max-width: 440px;
      width: 100%;
      text-align: center;
      padding: var(--space-10) var(--space-8);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-md);
      animation: ui-rise var(--transition-slow) both;
    }
    .denied__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      background: var(--danger-soft);
      color: var(--danger);
      margin-bottom: var(--space-5);
    }
    .denied__title {
      font-size: var(--fs-2xl);
    }
    .denied__text {
      margin-top: var(--space-3);
      color: var(--text-2);
    }
    .denied__permiso {
      display: inline-block;
      margin: 0 var(--space-1);
      padding: 2px var(--space-2);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: var(--fs-sm);
    }
    .denied__actions {
      margin-top: var(--space-6);
      display: flex;
      gap: var(--space-2);
      justify-content: center;
      flex-wrap: wrap;
    }
  `,
})
export class SinAcceso {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);

  readonly permiso = input('', { transform: textoUrl });
  readonly etiqueta = computed(() => etiquetaPermiso(this.permiso()));

  /** Primer módulo al que sí se tiene acceso, como salida útil. */
  readonly alternativa = computed(() => {
    const permisos = this.auth.permisos();
    const panel = panelesAccesibles(permisos)[0];
    const modulo = panel ? primerModuloAccesible(panel, permisos) : undefined;
    return panel && modulo ? { nombre: modulo.nombre, ruta: `${panel.ruta}/${modulo.ruta}` } : null;
  });

  ir(ruta: string): void {
    void this.router.navigateByUrl(ruta);
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
