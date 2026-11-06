import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Usuario } from '../../../../core/models';
import { Notificaciones } from '../../../../core/services/notificaciones';
import { UsuariosApi } from '../../../../core/services/usuarios.api';
import { aplicarErroresServidor, enfocarPrimerInvalido, errorServidor } from '../../../../shared/forms/errores-formulario';
import { coinciden, contrasenaSegura } from '../../../../shared/forms/validadores';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Modal } from '../../../../shared/ui/modal/modal';
import { RequisitosContrasena } from '../../../../shared/ui/requisitos/requisitos-contrasena';
import { formatearLogin } from '../../../../shared/util/formato';

/** Restablece la contraseña de otro usuario: acción de seguridad explícita y confirmada. */
@Component({
  selector: 'app-restablecer-contrasena',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Modal, Icon, RequisitosContrasena],
  template: `
    <ui-modal [abierto]="!!usuario()" titulo="Restablecer contraseña" [subtitulo]="subtitulo()" (cerrar)="cerrar.emit()">
      <p class="modal-hint">
        La persona deberá usar esta contraseña en su próximo inicio de sesión. Comunícasela por un canal seguro.
        El cambio queda registrado en la auditoría.
      </p>
      <form id="form-restablecer" class="grid-form" [formGroup]="formulario" (ngSubmit)="guardar()" novalidate>
        <div class="ui-field ui-field--full">
          <label class="ui-label" for="rc-nueva">Contraseña nueva <span class="ui-required" aria-hidden="true">*</span></label>
          <input id="rc-nueva" class="ui-input" [type]="visible() ? 'text' : 'password'" formControlName="contrasena"
            autocomplete="new-password" aria-required="true"
            [attr.aria-invalid]="invalido('contrasena') || null"
            [attr.aria-describedby]="invalido('contrasena') ? 'rc-reglas rc-nueva-error' : 'rc-reglas'" />
          <ui-requisitos-contrasena id="rc-reglas" [valor]="valor() ?? ''" />
          @if (invalido('contrasena')) {
            <span class="ui-error" id="rc-nueva-error">{{ errorServidor('contrasena') ?? 'La contraseña no cumple los requisitos.' }}</span>
          }
        </div>
        <div class="ui-field ui-field--full">
          <label class="ui-label" for="rc-confirmar">Confirmar contraseña <span class="ui-required" aria-hidden="true">*</span></label>
          <input id="rc-confirmar" class="ui-input" [type]="visible() ? 'text' : 'password'" formControlName="confirmacion"
            autocomplete="new-password" aria-required="true"
            [attr.aria-invalid]="invalido('confirmacion') || null"
            [attr.aria-describedby]="invalido('confirmacion') ? 'rc-confirmar-error' : null" />
          @if (invalido('confirmacion')) {
            <span class="ui-error" id="rc-confirmar-error">Las contraseñas no coinciden.</span>
          }
        </div>
        <button type="button" class="ui-btn ui-btn--ghost ui-btn--sm" [attr.aria-pressed]="visible()" (click)="visible.update((v) => !v)">
          <ui-icon [name]="visible() ? 'eyeOff' : 'eye'" [size]="16" />
          Mostrar contraseñas
        </button>
      </form>
      <div modal-footer class="modal-foot">
        <button type="button" class="ui-btn ui-btn--ghost" (click)="cerrar.emit()">Cancelar</button>
        <button type="submit" form="form-restablecer" class="ui-btn ui-btn--danger" [attr.aria-disabled]="guardando() || null">
          @if (guardando()) { <span class="ui-spinner ui-spinner--sm" aria-hidden="true"></span> }
          Restablecer contraseña
        </button>
      </div>
    </ui-modal>
  `,
})
export class RestablecerContrasena {
  private readonly fb = inject(FormBuilder);
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly notificaciones = inject(Notificaciones);

  readonly usuario = input<Usuario | null>(null);
  readonly cerrar = output<void>();

  readonly guardando = signal(false);
  readonly visible = signal(false);

  readonly formulario = this.fb.nonNullable.group(
    {
      contrasena: ['', [Validators.required, contrasenaSegura]],
      confirmacion: ['', Validators.required],
    },
    { validators: coinciden('contrasena', 'confirmacion') },
  );

  readonly valor = toSignal(this.formulario.controls.contrasena.valueChanges);

  constructor() {
    effect(() => {
      if (this.usuario()) {
        this.formulario.reset();
        this.visible.set(false);
      }
    });
  }

  subtitulo(): string {
    const usuario = this.usuario();
    return usuario ? `${usuario.nombre} ${usuario.apellido} · ${formatearLogin(usuario.usuario)}` : '';
  }

  invalido(campo: 'contrasena' | 'confirmacion'): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  errorServidor(campo: string): string | null {
    return errorServidor(this.formulario, campo);
  }

  guardar(): void {
    const usuario = this.usuario();
    if (!usuario || this.guardando()) {
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      enfocarPrimerInvalido();
      return;
    }
    this.guardando.set(true);
    this.usuariosApi
      .actualizar(usuario.id, { contrasena: this.formulario.controls.contrasena.value })
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: () => {
          this.notificaciones.exito('Contraseña restablecida', formatearLogin(usuario.usuario));
          this.cerrar.emit();
        },
        error: (err: unknown) => {
          if (!aplicarErroresServidor(this.formulario, err)) {
            this.notificaciones.errorHttp('No se pudo restablecer la contraseña', err);
          }
        },
      });
  }
}
