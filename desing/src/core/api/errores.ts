/** Error de la API con lo necesario para mostrarlo: estado, mensaje, errores por campo e id de petición. */
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
    readonly campos: Record<string, string> = {},
    readonly idPeticion: string | null = null,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }

  /** Errores de cliente (validación, permisos, conflicto): reintentar no ayuda. */
  get esDeCliente(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

/** Mensaje legible de cualquier error (para avisos y estados de error). */
export function mensajeDeError(e: unknown, porDefecto = "Ocurrió un error inesperado."): string {
  if (e instanceof ErrorApi) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return porDefecto;
}
