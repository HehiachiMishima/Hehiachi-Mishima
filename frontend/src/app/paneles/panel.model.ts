import { Type } from '@angular/core';
import { Routes } from '@angular/router';

/**
 * Tono de un panel: decide su degradado de marca (logo, cabecera, tarjeta en
 * el selector y acento de navegación). Los valores viven en styles/_tokens.scss
 * bajo `[data-tono='<tono>']`.
 */
export type TonoPanel = 'indigo' | 'violeta' | 'esmeralda' | 'ambar' | 'cian' | 'rosa';

/** Sección de la navegación lateral de un panel. */
export interface GrupoDef {
  id: string;
  nombre: string;
}

interface ModuloBase {
  /** Identificador único en TODA la aplicación (lo usan los enlaces entre módulos). */
  id: string;
  nombre: string;
  descripcion: string;
  /** Nombre de icono de shared/ui/icon/iconos.ts. */
  icono: string;
  /** Segmento de URL bajo el panel: `/<panel.ruta>/<ruta>`. */
  ruta: string;
  permiso: string;
  /** `id` de uno de los `grupos` del panel. */
  grupo: string;
}

/** Un módulo carga una página (`cargar`) o un árbol de rutas propio (`hijos`). */
export type ModuloDef = ModuloBase &
  (
    | { cargar: () => Promise<Type<unknown>>; hijos?: never }
    | { hijos: () => Promise<Routes>; cargar?: never }
  );

/** Un panel agrupa módulos bajo una misma URL, navegación y marca. */
export interface PanelDef {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  tono: TonoPanel;
  /** Segmento de URL del panel: `/<ruta>`. */
  ruta: string;
  /**
   * Permiso para entrar al panel. Si se omite, basta con tener acceso a alguno
   * de sus módulos (cada módulo sigue exigiendo el suyo).
   */
  permiso?: string;
  /** Orden de las secciones en la navegación. */
  grupos: readonly GrupoDef[];
  /** Orden de la navegación; el primero accesible es la entrada del panel. */
  modulos: readonly ModuloDef[];
}
