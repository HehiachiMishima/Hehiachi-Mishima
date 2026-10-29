import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Política de contraseñas (espejo de @ContrasenaSegura del backend). */
export const POLITICA_CONTRASENA = {
  minimo: 12,
  maximoBytes: 72,
} as const;

export interface ReglaContrasena {
  id: string;
  texto: string;
  cumple: (valor: string) => boolean;
}

const codificador = new TextEncoder();

export const REGLAS_CONTRASENA: ReglaContrasena[] = [
  {
    id: 'longitud',
    texto: `Al menos ${POLITICA_CONTRASENA.minimo} caracteres`,
    cumple: (valor) => valor.length >= POLITICA_CONTRASENA.minimo,
  },
  { id: 'letra', texto: 'Al menos una letra', cumple: (valor) => /\p{L}/u.test(valor) },
  { id: 'numero', texto: 'Al menos un número', cumple: (valor) => /\d/.test(valor) },
  {
    id: 'maximo',
    texto: 'No más de 72 bytes (unos 72 caracteres sin tildes)',
    cumple: (valor) => codificador.encode(valor).length <= POLITICA_CONTRASENA.maximoBytes,
  },
];

/** Valida la política de contraseñas; un valor vacío lo decide `required`. */
export const contrasenaSegura: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = String(control.value ?? '');
  if (!valor) {
    return null;
  }
  const incumplidas = REGLAS_CONTRASENA.filter((regla) => !regla.cumple(valor)).map((regla) => regla.id);
  return incumplidas.length ? { contrasena: incumplidas } : null;
};

/** El grupo exige que `campo` y `confirmacion` coincidan. */
export function coinciden(campo: string, confirmacion: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const destino = grupo.get(confirmacion);
    const iguales = grupo.get(campo)?.value === destino?.value;
    if (destino && !iguales && destino.value) {
      destino.setErrors({ ...destino.errors, distinta: true });
    } else if (destino?.hasError('distinta')) {
      const { distinta: _, ...resto } = destino.errors ?? {};
      destino.setErrors(Object.keys(resto).length ? resto : null);
    }
    return null;
  };
}
