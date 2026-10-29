import { HttpErrorResponse } from '@angular/common/http';
import { FormGroup } from '@angular/forms';
import { camposDeError, mensajeDeError } from '../../core/errors/error.util';

/**
 * Traslada los errores del backend a los controles del formulario:
 * `campos` del 400 de validación y el 409 de duplicado. Devuelve true si
 * algún error quedó asociado a un campo (y entonces no hace falta un aviso global).
 */
export function aplicarErroresServidor(
  formulario: FormGroup,
  err: unknown,
  conflicto?: (mensajeServidor: string) => { campo: string; mensaje: string } | null,
): boolean {
  let aplicado = false;
  for (const [campo, mensaje] of Object.entries(camposDeError(err))) {
    const control = formulario.get(campo);
    if (control) {
      control.setErrors({ ...control.errors, servidor: mensaje });
      control.markAsTouched();
      aplicado = true;
    }
  }
  const destino = !aplicado && conflicto && err instanceof HttpErrorResponse && err.status === 409
    ? conflicto(mensajeDeError(err))
    : null;
  if (destino) {
    const control = formulario.get(destino.campo);
    if (control) {
      control.setErrors({ servidor: destino.mensaje });
      control.markAsTouched();
      aplicado = true;
    }
  }
  if (aplicado) {
    enfocarPrimerInvalido();
  }
  return aplicado;
}

/** Mensaje del servidor asociado a un control, si existe. */
export function errorServidor(formulario: FormGroup, campo: string): string | null {
  const valor = formulario.get(campo)?.errors?.['servidor'];
  return typeof valor === 'string' ? valor : null;
}

/** Lleva el foco al primer campo inválido tras pintarse aria-invalid (WCAG 3.3.1). */
export function enfocarPrimerInvalido(): void {
  setTimeout(() => document.querySelector<HTMLElement>('form [aria-invalid="true"]')?.focus());
}
