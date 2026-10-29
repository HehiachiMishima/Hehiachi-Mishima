import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PANELES, PanelDef, panelesAccesibles } from '../../core/config/paneles';
import { Auth } from '../../core/services/auth';
import { Notificaciones } from '../../core/services/notificaciones';
import { TemaService } from '../../core/services/tema';
import { MenuCuenta } from '../cuenta/menu-cuenta';
import { Icon } from '../../shared/ui/icon/icon';

@Component({
  selector: 'app-launcher',
  imports: [Icon, MenuCuenta],
  templateUrl: './launcher.html',
  styleUrl: './launcher.scss',
})
export class Launcher {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(Notificaciones);
  readonly tema = inject(TemaService);

  readonly paneles = PANELES;
  readonly permisos = this.auth.permisos;

  readonly accesibles = computed(() => panelesAccesibles(this.permisos()).length);

  accesible(panel: PanelDef): boolean {
    return this.permisos().includes(panel.permiso);
  }

  abrir(panel: PanelDef): void {
    if (this.accesible(panel)) {
      void this.router.navigateByUrl(panel.ruta);
      return;
    }
    this.notificaciones.advertencia(
      'Sin acceso',
      `No tienes permiso para entrar en ${panel.nombre}. Solicítalo a un administrador.`,
    );
  }

  alternarTema(evento: Event): void {
    this.tema.alternar(evento);
  }
}
