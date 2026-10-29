import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { PANEL_ADMIN, primerModuloAccesible } from '../../../core/config/paneles';
import { PERMISOS } from '../../../core/config/permisos';
import { permisoGuard } from '../../../core/guards/permiso.guard';
import { SesionStore } from '../../../core/services/sesion';
import { AdminShell } from './admin-shell';

function primerModuloAdmin(): string {
  const modulo = primerModuloAccesible(PANEL_ADMIN, inject(SesionStore).permisos());
  return modulo ? `/admin/${modulo.ruta}` : '/sin-acceso';
}

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: primerModuloAdmin },
      {
        path: 'dashboard',
        title: 'Resumen · Administración',
        canActivate: [permisoGuard(PERMISOS.DASHBOARD_ADMIN)],
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'auditoria',
        title: 'Auditoría · Administración',
        canActivate: [permisoGuard(PERMISOS.VER_AUDITORIA)],
        loadComponent: () => import('./pages/auditoria/auditoria').then((m) => m.Auditoria),
      },
      {
        path: 'usuarios',
        title: 'Usuarios · Administración',
        canActivate: [permisoGuard(PERMISOS.VER_USUARIOS)],
        loadComponent: () => import('./pages/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'roles',
        title: 'Roles · Administración',
        canActivate: [permisoGuard(PERMISOS.VER_ROLES)],
        loadComponent: () => import('./pages/roles/roles').then((m) => m.Roles),
      },
      {
        path: 'permisos',
        title: 'Permisos · Administración',
        canActivate: [permisoGuard(PERMISOS.VER_PERMISOS)],
        loadComponent: () => import('./pages/permisos/permisos').then((m) => m.Permisos),
      },
    ],
  },
];
