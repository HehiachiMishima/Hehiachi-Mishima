import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Anunciador } from './core/services/anunciador';
import { Carga } from './core/services/carga';
import { SesionVigilante } from './core/services/sesion-vigilante';
import { TemaService } from './core/services/tema';
import { AvisoSesion } from './features/cuenta/aviso-sesion';
import { Loader } from './shared/ui/loader/loader';
import { ToastHost } from './shared/ui/toast/toast-host';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost, Loader, AvisoSesion],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly anunciador = inject(Anunciador);
  protected readonly carga = inject(Carga);
  private readonly tema = inject(TemaService);
  private readonly vigilante = inject(SesionVigilante);

  /** Lleva el foco al contenido principal sin alterar la URL del router. */
  saltarAlContenido(evento: Event): void {
    evento.preventDefault();
    const destino = document.getElementById('contenido');
    destino?.focus();
    destino?.scrollIntoView();
  }
}
