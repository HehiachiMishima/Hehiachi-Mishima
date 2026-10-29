import { HttpResponse } from '@angular/common/http';

/** Nombre de archivo de la cabecera Content-Disposition, o el de respaldo. */
export function nombreDeArchivo(respuesta: HttpResponse<unknown>, respaldo: string): string {
  const disposicion = respuesta.headers.get('Content-Disposition') ?? '';
  const coincidencia = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposicion);
  return coincidencia ? decodeURIComponent(coincidencia[1]) : respaldo;
}

/** Ofrece un Blob al navegador como descarga. */
export function guardarArchivo(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
