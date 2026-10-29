import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const NOMBRE_APLICACION = 'Hehiachi Mishima';

/** Título del documento por ruta (WCAG 2.4.2): "Usuarios · Administración · Hehiachi Mishima". */
@Injectable({ providedIn: 'root' })
export class TituloEstrategia extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(estado: RouterStateSnapshot): void {
    const titulo = this.buildTitle(estado);
    this.title.setTitle(titulo ? `${titulo} · ${NOMBRE_APLICACION}` : NOMBRE_APLICACION);
  }
}
