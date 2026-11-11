/** Política de contraseñas (espejo de @ContrasenaSegura del backend). */
export const POLITICA_CONTRASENA = { minimo: 12, maximoBytes: 72 } as const;

export interface ReglaContrasena {
  id: string;
  texto: string;
  cumple: (valor: string) => boolean;
}

const codificador = new TextEncoder();

export const REGLAS_CONTRASENA: ReglaContrasena[] = [
  { id: "longitud", texto: `Al menos ${POLITICA_CONTRASENA.minimo} caracteres`, cumple: (v) => v.length >= POLITICA_CONTRASENA.minimo },
  { id: "letra", texto: "Al menos una letra", cumple: (v) => /\p{L}/u.test(v) },
  { id: "numero", texto: "Al menos un número", cumple: (v) => /\d/.test(v) },
  { id: "maximo", texto: "No más de 72 bytes (unos 72 caracteres sin tildes)", cumple: (v) => codificador.encode(v).length <= POLITICA_CONTRASENA.maximoBytes },
];

export const contrasenaValida = (v: string): boolean => REGLAS_CONTRASENA.every((r) => r.cumple(v));
