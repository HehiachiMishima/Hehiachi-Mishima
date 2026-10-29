import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { panelesAccesibles } from '../config/paneles';
import { SesionStore } from '../services/sesion';

/** Con un único panel accesible, el selector de paneles sobra: se entra directo. */
export const launcherGuard: CanActivateFn = () => {
  const accesibles = panelesAccesibles(inject(SesionStore).permisos());
  return accesibles.length === 1 ? inject(Router).parseUrl(accesibles[0].ruta) : true;
};
