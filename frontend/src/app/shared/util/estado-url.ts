import { inject, numberAttribute } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CONFIG } from '../../core/config/configuracion';

type ValorUrl = string | number | boolean | null | undefined;

/**
 * Estado de filtros y paginación en los query params (enlazable y
 * compartible). Los componentes leen los parámetros como inputs gracias a
 * withComponentInputBinding y escriben con `fijar`. Los valores vacíos o
 * `false` se eliminan de la URL. Debe llamarse en un contexto de inyección.
 */
export function crearEstadoUrl() {
  const router = inject(Router);
  const ruta = inject(ActivatedRoute);
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  const navegar = (cambios: Record<string, ValorUrl>): void => {
    const queryParams: Record<string, string | number | null> = {};
    for (const [clave, valor] of Object.entries(cambios)) {
      queryParams[clave] = valor === '' || valor === false || valor === undefined || valor === null ? null : valor === true ? 1 : valor;
    }
    void router.navigate([], { relativeTo: ruta, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  };

  return {
    /** Aplica cambios en la URL; con `diferido` espera a que el usuario deje de teclear. */
    fijar(cambios: Record<string, ValorUrl>, diferido = false): void {
      clearTimeout(temporizador);
      if (diferido) {
        temporizador = setTimeout(() => navegar(cambios), CONFIG.busqueda.debounceMs);
      } else {
        navegar(cambios);
      }
    },
  };
}

/** Transformación de input para números de la URL con valor por defecto. */
export function numeroUrl(porDefecto: number) {
  return (valor: unknown): number => {
    const numero = numberAttribute(valor, porDefecto);
    return numero > 0 ? numero : porDefecto;
  };
}

/** Transformación de input para banderas de la URL ("1" / "true"). */
export function banderaUrl(valor: unknown): boolean {
  return valor === '1' || valor === 'true' || valor === true;
}

/** Pagina una lista en memoria acotando la página al rango válido. */
export function paginar<T>(lista: T[], pagina: number, tamano: number): { items: T[]; pagina: number } {
  const total = Math.max(1, Math.ceil(lista.length / tamano));
  const actual = Math.min(Math.max(1, pagina), total);
  const inicio = (actual - 1) * tamano;
  return { items: lista.slice(inicio, inicio + tamano), pagina: actual };
}

/**
 * Transformación de input para textos de la URL. Con withComponentInputBinding
 * un query param ausente llega como `undefined` y anula el valor por defecto.
 */
export function textoUrl(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

/** Transformación de input para un valor de una lista cerrada, con valor por defecto. */
export function opcionUrl<T extends string>(opciones: readonly T[], porDefecto: T) {
  return (valor: unknown): T => (opciones.includes(valor as T) ? (valor as T) : porDefecto);
}
