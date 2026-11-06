/**
 * REGISTRO DE PANELES
 * ===================
 * La aplicación es: login → paneles → módulos. Cada panel (p. ej.
 * Administración) agrupa módulos bajo `/<panel>/<módulo>` con su propia
 * navegación y su tono de marca. De este registro se derivan, sin duplicar
 * nada: las rutas (app.routes.ts), el selector de paneles, el conmutador de
 * panel de la barra lateral, la navegación por secciones, la miga de pan, los
 * títulos del documento, la paleta Ctrl/⌘ K y la salida de "Acceso denegado".
 *
 * Estructura de carpetas
 * ----------------------
 *   src/app/paneles/
 *     panel.model.ts                    tipos PanelDef / ModuloDef / GrupoDef
 *     registro.ts                       este archivo: PANELES + utilidades
 *     <panel>/<panel>.panel.ts          definición del panel (grupos y módulos)
 *     <panel>/modulos/<modulo>/         una carpeta por módulo
 *
 * Cómo añadir un panel
 * --------------------
 * 1. Crea `src/app/paneles/<panel>/<panel>.panel.ts` exportando un `PanelDef`
 *    (`ruta` única, `tono`, `grupos`, `modulos`; `permiso` opcional).
 * 2. Añádelo a `PANELES` (abajo). El orden es el del selector de paneles.
 *
 * Cómo añadir un módulo a un panel
 * --------------------------------
 * 1. Crea `src/app/paneles/<panel>/modulos/<id>/` con su página standalone
 *    (`<id>.ts`, `.html`, `.scss`) y sus subcomponentes dentro.
 * 2. Si necesita un permiso nuevo, añádelo a `PERMISOS`
 *    (core/config/permisos.ts) con el mismo código que en el backend.
 * 3. Añade la entrada en `modulos` del panel con
 *    `cargar: () => import('./modulos/<id>/<id>').then((m) => m.Clase)`
 *    (o `hijos` con loadChildren si tiene subrutas). El `id` debe ser único
 *    en toda la aplicación.
 * Ruta, guard de permiso, título, menú y miga de pan salen solos.
 */
import { PANEL_ADMINISTRACION } from './administracion/administracion.panel';
import { ModuloDef, PanelDef } from './panel.model';

export const PANELES: readonly PanelDef[] = [PANEL_ADMINISTRACION];

export function panelPorId(id: string): PanelDef | undefined {
  return PANELES.find((panel) => panel.id === id);
}

export function modulosAccesibles(panel: PanelDef, permisos: readonly string[]): ModuloDef[] {
  return panel.modulos.filter((modulo) => permisos.includes(modulo.permiso));
}

export function primerModuloAccesible(panel: PanelDef, permisos: readonly string[]): ModuloDef | undefined {
  return panel.modulos.find((modulo) => permisos.includes(modulo.permiso));
}

/** Se entra a un panel con su permiso (si lo declara) y acceso a algún módulo. */
export function puedeEntrarAlPanel(panel: PanelDef, permisos: readonly string[]): boolean {
  return (!panel.permiso || permisos.includes(panel.permiso)) && !!primerModuloAccesible(panel, permisos);
}

export function panelesAccesibles(permisos: readonly string[]): PanelDef[] {
  return PANELES.filter((panel) => puedeEntrarAlPanel(panel, permisos));
}

export function urlPanel(panel: PanelDef): string {
  return `/${panel.ruta}`;
}

export function urlModulo(panel: PanelDef, modulo: Pick<ModuloDef, 'ruta'>): string {
  return `/${panel.ruta}/${modulo.ruta}`;
}

/** URL de un módulo por su id, busque en el panel que esté (enlaces entre módulos). */
export function urlModuloPorId(id: string): string {
  for (const panel of PANELES) {
    const modulo = panel.modulos.find((m) => m.id === id);
    if (modulo) {
      return urlModulo(panel, modulo);
    }
  }
  throw new Error(`Módulo no registrado: ${id}`);
}

/** Módulo del panel al que pertenece una URL (miga de pan y estado activo). */
export function moduloDeUrl(panel: PanelDef, url: string): ModuloDef | undefined {
  const [raiz, segmento] = url.split(/[?#]/)[0].split('/').filter(Boolean);
  return raiz === panel.ruta ? panel.modulos.find((modulo) => modulo.ruta === segmento) : undefined;
}

/** Destino tras iniciar sesión o al pulsar la marca: el portal de paneles (o acceso denegado si no hay ninguno). */
export function destinoInicial(permisos: readonly string[]): string {
  return panelesAccesibles(permisos).length > 0 ? '/paneles' : '/sin-acceso';
}
