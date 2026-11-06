import { InjectionToken, Provider, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PanelDef } from './panel.model';
import { panelPorId } from './registro';

/**
 * Panel en el que se está trabajando. Lo provee PanelShell (a partir de
 * `data.panel` de su ruta) y lo heredan todos sus módulos. Fuera de un panel
 * (selector, acceso denegado global) no existe: inyéctalo con `{ optional: true }`.
 */
export const PANEL_ACTUAL = new InjectionToken<PanelDef>('PANEL_ACTUAL');

export function proveerPanelActual(): Provider {
  return {
    provide: PANEL_ACTUAL,
    useFactory: () => {
      const id = inject(ActivatedRoute).snapshot.data['panel'] as string;
      const panel = panelPorId(id);
      if (!panel) {
        throw new Error(`Panel no registrado: ${id}`);
      }
      return panel;
    },
  };
}
