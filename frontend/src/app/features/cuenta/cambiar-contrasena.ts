import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { mensajeDeError } from '../../core/errors/error.util';
import { Auth } from '../../core/services/auth';
import { Notificaciones } from '../../core/services/notificaciones';
import { aplicarErroresServidor, enfocarPrimerInvalido, errorServidor } from '../../shared/forms/errores-formulario';
import { coinciden, contrasenaSegura } from '../../shared/forms/validadores';
import { Icon } from '../../shared/ui/icon/icon';
import { Modal } from '../../shared/ui/modal/modal';
import { RequisitosContrasena } from '../../shared/ui/requisitos/requisitos-contrasena';
import { Button } from '../../shared/ui/button/button';

type Campo = 'contrasenaActual' | 'contrasenaNueva' | 'confirmacion';

/** Cambio de la contraseña propia (PUT /auth/contrasena). */
@Component({
  selector: 'app-cambiar-contrasena',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, Icon, RequisitosContrasena, Button],
  template: `
    <ui-modal [abierto]="abierto()" titulo="Cambiar mi contraseña" subtitulo="Por seguridad, confirma tu contraseña actual." (cerrar)="cerrar.emit()">
      <form id="form-contrasena" class="grid-form" [formGroup]="formulario" (ngSubmit)="guardar()" novalidate>
        <p class="ui-hint grid-form__nota">Todos los campos son obligatorios.</p>

        <div class="ui-field ui-field--full">
          <label class="ui-label" for="cc-actual">Contraseña actual</label>
          <input id="cc-actual" class="ui-input" [type]="visible() ? 'text' : 'password'" formControlName="contrasenaActual"
            autocomplete="current-password" aria-required="true"
            [attr.aria-invalid]="invalido('contrasenaActual') || null"
            [attr.aria-describedby]="invalido('contrasenaActual') ? 'cc-actual-error' : null" />
          @if (invalido('contrasenaActual')) {
            <span class="ui-error" id="cc-actual-error">{{ errorServidor('contrasenaActual') ?? 'Ingresa tu contraseña actual.' }}</span>
          }
        </div>

        <div class="ui-field ui-field--full">
          <label class="ui-label" for="cc-nueva">Contraseña nueva</label>
          <input id="cc-nueva" class="ui-input" [type]="visible() ? 'text' : 'password'" formControlName="contrasenaNueva"
            autocomplete="new-password" aria-required="true"
            [attr.aria-invalid]="invalido('contrasenaNueva') || null"
            [attr.aria-describedby]="invalido('contrasenaNueva') ? 'cc-reglas cc-nueva-error' : 'cc-reglas'" />
          <ui-requisitos-contrasena id="cc-reglas" [valor]="nueva() ?? ''" />
          @if (invalido('contrasenaNueva')) {
            <span class="ui-error" id="cc-nueva-error">{{ errorServidor('contrasenaNueva') ?? 'La contraseña nueva no cumple los requisitos.' }}</span>
          }
        </div>

        <div class="ui-field ui-field--full">
          <label class="ui-label" for="cc-confirmar">Confirmar contraseña nueva</label>
          <input id="cc-confirmar" class="ui-input" [type]="visible() ? 'text' : 'password'" formControlName="confirmacion"
            autocomplete="new-password" aria-required="true"
            [attr.aria-invalid]="invalido('confirmacion') || null"
            [attr.aria-describedby]="invalido('confirmacion') ? 'cc-confirmar-error' : null" />
          @if (invalido('confirmacion')) {
            <span class="ui-error" id="cc-confirmar-error">Las contraseñas no coinciden.</span>
          }
        </div>

        <button type="button" appButton variant="ghost" size="sm" [attr.aria-pressed]="visible()" (click)="visible.update((v) => !v)">
          <ui-icon [name]="visible() ? 'eyeOff' : 'eye'" [size]="16" />
          Mostrar contraseñas
        </button>
      </form>

      <div modal-footer class="modal-foot">
        <button type="button" appButton variant="ghost" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="form-contrasena" appButton [attr.aria-disabled]="guardando() || null">
          @if (guardando()) { <span class="ui-spinner ui-spinner--sm" aria-hidden="true"></span> }
          Cambiar contraseña
        </button>
      </div>
    </ui-modal>
  `,
})
export class CambiarContrasena {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly notificaciones = inject(Notificaciones);

  readonly abierto = input(false);
  readonly cerrar = output<void>();

  readonly guardando = signal(false);
  readonly visible = signal(false);

  readonly formulario = this.fb.nonNullable.group(
    {
      contrasenaActual: ['', Validators.required],
      contrasenaNueva: ['', [Validators.required, contrasenaSegura]],
      confirmacion: ['', Validators.required],
    },
    { validators: coinciden('contrasenaNueva', 'confirmacion') },
  );

  readonly nueva = toSignal(this.formulario.controls.contrasenaNueva.valueChanges);

  constructor() {
    effect(() => {
      if (this.abierto()) {
        this.formulario.reset();
        this.visible.set(false);
      }
    });
  }

  invalido(campo: Campo): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  errorServidor(campo: Campo): string | null {
    return errorServidor(this.formulario, campo);
  }

  guardar(): void {
    if (this.guardando()) {
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      enfocarPrimerInvalido();
      return;
    }
    const { contrasenaActual, contrasenaNueva } = this.formulario.getRawValue();
    this.guardando.set(true);
    this.auth
      .cambiarContrasena({ contrasenaActual, contrasenaNueva })
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: () => {
          this.notificaciones.exito('Contraseña actualizada', 'Úsala la próxima vez que inicies sesión.');
          this.cerrar.emit();
        },
        error: (err: unknown) => this.alFallar(err),
      });
  }

  private alFallar(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      // 401 aquí es "contraseña actual incorrecta"; con otro mensaje, la sesión ya no es válida.
      if (/actual/i.test(mensajeDeError(err))) {
        this.formulario.controls.contrasenaActual.setErrors({ servidor: 'Tu contraseña actual no es correcta.' });
        this.formulario.controls.contrasenaActual.markAsTouched();
        enfocarPrimerInvalido();
      } else {
        this.cerrar.emit();
        this.auth.expulsar('revocada');
      }
      return;
    }
    if (!aplicarErroresServidor(this.formulario, err)) {
      this.notificaciones.errorHttp('No se pudo cambiar la contraseña', err);
    }
  }
}
