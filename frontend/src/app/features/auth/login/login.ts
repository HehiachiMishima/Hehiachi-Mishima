import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CONFIG } from '../../../core/config/configuracion';
import { mensajeDeError } from '../../../core/errors/error.util';
import { Auth } from '../../../core/services/auth';
import { Carga } from '../../../core/services/carga';
import { Notificaciones } from '../../../core/services/notificaciones';
import { enfocarPrimerInvalido } from '../../../shared/forms/errores-formulario';
import { Icon } from '../../../shared/ui/icon/icon';
import { LightPillar } from '../../../shared/ui/light-pillar/light-pillar';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Icon, LightPillar],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notificaciones = inject(Notificaciones);
  private readonly carga = inject(Carga);

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly verContrasena = signal(false);
  /** Pausa de la animación de fondo (WCAG 2.2.2), recordada por navegador. */
  readonly animacionPausada = signal(this.leerPausa());

  readonly formulario = this.fb.nonNullable.group({
    usuario: ['', [Validators.required]],
    contrasena: ['', [Validators.required]],
  });

  campoInvalido(campo: 'usuario' | 'contrasena'): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  toggleContrasena(): void {
    this.verContrasena.update((valor) => !valor);
  }

  alternarAnimacion(): void {
    this.animacionPausada.update((valor) => !valor);
    try {
      localStorage.setItem(CONFIG.almacenamiento.animacionPausada, String(this.animacionPausada()));
    } catch {
      /* almacenamiento no disponible */
    }
  }

  enviar(): void {
    if (this.cargando()) {
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      enfocarPrimerInvalido();
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.carga.mostrar('Iniciando sesión…');

    const { usuario, contrasena } = this.formulario.getRawValue();

    this.auth.iniciarSesion({ usuario, contrasena }).subscribe({
      next: (datos) => {
        this.cargando.set(false);
        this.notificaciones.exito('Acceso concedido', `Hola, ${datos.usuario?.nombre ?? usuario}.`);
        const destino = this.route.snapshot.queryParamMap.get('returnUrl') ?? CONFIG.rutas.inicio;
        void this.router.navigateByUrl(destino).then(() => {
          setTimeout(() => this.carga.ocultar(), 450);
        });
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.carga.ocultar();
        this.error.set(mensajeDeError(err));
      },
    });
  }

  private leerPausa(): boolean {
    try {
      return localStorage.getItem(CONFIG.almacenamiento.animacionPausada) === 'true';
    } catch {
      return false;
    }
  }
}
