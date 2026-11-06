import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { etiquetaPermiso } from '../../core/config/permisos';
import { Auth } from '../../core/services/auth';
import { PANEL_ACTUAL } from '../../paneles/panel-actual';
import { panelesAccesibles, primerModuloAccesible, urlModulo, urlPanel } from '../../paneles/registro';
import { textoUrl } from '../../shared/util/estado-url';
import { Icon } from '../../shared/ui/icon/icon';

@Component({
  selector: 'app-sin-acceso',
  imports: [Icon],
  template: `
    <div class="denied">
      <div class="denied__card">
        <span class="denied__icon" aria-hidden="true"><ui-icon name="lock" [size]="30" /></span>
        <h1 class="denied__title" tabindex="-1">Acceso denegado</h1>
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
    </div>
  `,
  styles: `
    .denied {
      min-height: 60dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-6);
    }
    .denied__card {
      max-width: 440px;
      width: 100%;
      text-align: center;
      position: relative;
      overflow: hidden;
      padding: var(--space-12) var(--space-8) var(--space-10);
      background:
        radial-gradient(360px 180px at 50% 0%, rgba(225, 29, 72, 0.12), transparent 70%),
        var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-2xl);
      box-shadow: var(--shadow-lg);
      animation: ui-rise var(--transition-slow) both;
    }
    .denied__card::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 4px;
      background: linear-gradient(90deg, #f59e0b, #e11d48 50%, #c026d3);
    }
    .denied__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      border-radius: var(--radius-2xl);
      background: linear-gradient(135deg, #e11d48 0%, #be123c 55%, #9d174d 100%);
      color: #ffffff;
      box-shadow: 0 16px 32px -12px rgba(225, 29, 72, 0.7), 0 0 0 8px rgba(225, 29, 72, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
      margin-bottom: var(--space-6);
    }
    .denied__title {
      font-size: var(--fs-2xl);
      font-weight: var(--fw-heavy);
      letter-spacing: var(--tracking-display);
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
