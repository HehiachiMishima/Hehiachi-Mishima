import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CONFIG } from '../config/configuracion';
import { SesionStore } from '../services/sesion';

/** Exige un permiso; sin él lleva a `salida` (la vista de acceso denegado del panel). */
export function permisoGuard(permiso: string, salida: string = CONFIG.rutas.sinAcceso): CanActivateFn {
  return () => {
    const sesion = inject(SesionStore);
    const router = inject(Router);

    if (!sesion.autenticado()) {
      return router.createUrlTree([CONFIG.rutas.login]);
    }
    if (sesion.tienePermiso(permiso)) {
      return true;
    }
    return router.createUrlTree([salida], { queryParams: { permiso } });
  };
}
