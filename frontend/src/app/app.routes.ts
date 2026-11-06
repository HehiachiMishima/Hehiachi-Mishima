import { inject } from '@angular/core';
import { CanActivateFn, RedirectFunction, Route, Router, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permisoGuard } from './core/guards/permiso.guard';
import { SesionStore } from './core/services/sesion';
import { ModuloDef, PanelDef } from './paneles/panel.model';
import { PANELES, destinoInicial, primerModuloAccesible, puedeEntrarAlPanel, urlModulo } from './paneles/registro';

/** Raíz: un solo panel → su primer módulo; varios → selector; ninguno → acceso denegado. */
const alInicio: RedirectFunction = () => destinoInicial(inject(SesionStore).permisos());

/** Entrada de un panel: su primer módulo accesible. */
function alPrimerModulo(panel: PanelDef): RedirectFunction {
  return () => {
    const modulo = primerModuloAccesible(panel, inject(SesionStore).permisos());
    return modulo ? urlModulo(panel, modulo) : `/${panel.ruta}/sin-acceso`;
  };
}

function panelGuard(panel: PanelDef): CanActivateFn {
  return () =>
    puedeEntrarAlPanel(panel, inject(SesionStore).permisos()) ||
    inject(Router).createUrlTree(['/sin-acceso'], panel.permiso ? { queryParams: { permiso: panel.permiso } } : {});
}

function rutaDeModulo(panel: PanelDef, modulo: ModuloDef): Route {
  const base: Route = {
    path: modulo.ruta,
    title: `${modulo.nombre} · ${panel.nombre}`,
    canActivate: [permisoGuard(modulo.permiso, `/${panel.ruta}/sin-acceso`)],
  };
  return modulo.hijos ? { ...base, loadChildren: modulo.hijos } : { ...base, loadComponent: modulo.cargar };
}

const sinAcceso: Route = {
  path: 'sin-acceso',
  title: 'Acceso denegado',
  loadComponent: () => import('./layout/sin-acceso/sin-acceso').then((m) => m.SinAcceso),
};

function rutaDePanel(panel: PanelDef): Route {
  return {
    path: panel.ruta,
    data: { panel: panel.id },
    canActivate: [panelGuard(panel)],
    loadComponent: () => import('./layout/panel-shell').then((m) => m.PanelShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: alPrimerModulo(panel) },
      ...panel.modulos.map((modulo) => rutaDeModulo(panel, modulo)),
      sinAcceso,
    ],
  };
}

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  // Compatibilidad: el antiguo "dashboard" del panel de administración es hoy "resumen".
  { path: 'admin/dashboard', redirectTo: '/admin/resumen' },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: alInicio },
      {
        path: '',
        loadComponent: () => import('./layout/portal/portal').then((m) => m.Portal),
        children: [
          {
            path: 'paneles',
            title: 'Paneles',
            loadComponent: () => import('./layout/portal/selector-paneles').then((m) => m.SelectorPaneles),
          },
          sinAcceso,
        ],
      },
      ...PANELES.map(rutaDePanel),
    ],
  },
  { path: '**', redirectTo: '' },
];
