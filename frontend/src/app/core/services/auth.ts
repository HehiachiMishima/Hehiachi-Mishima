import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay, tap } from 'rxjs';
import { CONFIG } from '../config/configuracion';
import { environment } from '../../../environments/environment';
import { CABECERA_AJAX } from '../interceptors/contexto';
import { ApiResponse, AuthResponse, CambiarContrasenaRequest, LoginRequest, SesionVigente } from '../models';
import { Carga } from './carga';
import { Notificaciones } from './notificaciones';
import { SesionStore } from './sesion';

/** Intervalo mínimo entre dos refrescos de la sesión (foco de ventana, 403…). */
const REFRESCO_MINIMO_MS = 15_000;

@Service()
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sesionStore = inject(SesionStore);
  private readonly carga = inject(Carga);
  private readonly notificaciones = inject(Notificaciones);
  private readonly base = environment.apiUrl.replace(/\/+$/, '');
  private ultimoRefresco = 0;
  /** Renovación en curso, compartida: varias peticiones con 401 disparan UN solo /auth/refresh. */
  private renovacion: Observable<boolean> | null = null;

  readonly sesion = this.sesionStore.sesion;
  readonly permisos = this.sesionStore.permisos;
  readonly usuario = this.sesionStore.usuario;
  readonly autenticado = this.sesionStore.autenticado;

  /** Login: el access token queda en memoria y el servidor deja el refresh token en una cookie HttpOnly. */
  iniciarSesion(credenciales: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.base}/auth/login`, credenciales, { withCredentials: true })
      .pipe(
        map((respuesta) => respuesta.datos),
        tap((datos) => this.guardar(datos)),
      );
  }

  /**
   * Pide un access token nuevo con la cookie del refresh token (sin
   * contraseña). Emite true si se renovó y false si la sesión ya no es
   * renovable (vencida por inactividad o por el máximo, revocada, cerrada).
   * Nunca falla: quien llama decide si expulsa.
   */
  renovar(): Observable<boolean> {
    if (!this.renovacion) {
      this.renovacion = this.http
        .post<ApiResponse<AuthResponse>>(`${this.base}/auth/refresh`, {}, { withCredentials: true, headers: CABECERA_AJAX })
        .pipe(
          map((respuesta) => respuesta.datos),
          tap((datos) => this.guardar(datos)),
          map(() => true),
          catchError(() => of(false)),
          finalize(() => (this.renovacion = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.renovacion;
  }

  /** Al arrancar la app (recarga, pestaña nueva): recupera la sesión desde la cookie si existe. */
  async restaurar(): Promise<void> {
    if (!this.sesionStore.autenticado()) {
      await firstValueFrom(this.renovar());
    }
  }

  private guardar(datos: AuthResponse): void {
    this.sesionStore.guardar({
      token: datos.token,
      tipo: datos.tipo,
      expiraEn: datos.expiraEn,
      usuario: datos.usuario,
      permisos: datos.permisos,
    });
  }

  /** Revoca en el servidor la sesión (familia del refresh token) y borra la cookie. Sin esperar respuesta. */
  private revocarEnServidor(): void {
    this.http
      .post(`${this.base}/auth/logout`, {}, { withCredentials: true, headers: CABECERA_AJAX })
      .subscribe({ error: () => undefined });
  }

  /**
   * Cambia la contraseña propia. Si el backend devuelve un token nuevo (los
   * anteriores quedan revocados) se guarda para no perder la sesión actual.
   */
  cambiarContrasena(peticion: CambiarContrasenaRequest): Observable<void> {
    return this.http
      // withCredentials: el servidor revoca las sesiones anteriores y deja una cookie nueva para esta.
      .put<ApiResponse<Partial<AuthResponse> | null>>(`${this.base}/auth/contrasena`, peticion, { withCredentials: true })
      .pipe(
        tap((respuesta) => {
          const datos = respuesta?.datos;
          if (datos?.token) {
            this.sesionStore.actualizarToken(datos.token, datos.expiraEn);
          }
        }),
        map(() => undefined),
      );
  }

  /**
   * Relee identidad y permisos vigentes (GET /auth/sesion). Si otro
   * administrador cambió mis accesos, la interfaz se adapta y se avisa.
   */
  refrescarSesion(forzar = false): Observable<void> {
    const ahora = Date.now();
    if (!this.sesionStore.autenticado() || (!forzar && ahora - this.ultimoRefresco < REFRESCO_MINIMO_MS)) {
      return of(undefined);
    }
    this.ultimoRefresco = ahora;
    return this.http.get<ApiResponse<SesionVigente>>(`${this.base}/auth/sesion`).pipe(
      map((respuesta) => respuesta.datos),
      tap((vigente) => {
        const antes = [...this.sesionStore.permisos()].sort().join(',');
        const despues = [...vigente.permisos].sort().join(',');
        this.sesionStore.actualizarVigente(vigente.usuario, vigente.permisos);
        if (antes !== despues) {
          this.notificaciones.info('Tus permisos cambiaron', 'La interfaz se actualizó con tus accesos vigentes.');
        }
      }),
      map(() => undefined),
    );
  }

  cerrarSesion(redirigir = true): void {
    this.revocarEnServidor();
    this.sesionStore.limpiar();
    if (!redirigir) {
      return;
    }
    this.carga.mostrar('Cerrando sesión…');
    void this.router.navigate([CONFIG.rutas.login]).then(() => {
      setTimeout(() => this.carga.ocultar(), 450);
    });
  }

  /**
   * Cierra una sesión que el servidor ya no acepta (vencida o revocada) y
   * lleva al login conservando la ruta de vuelta.
   */
  expulsar(motivo: 'expirada' | 'revocada'): void {
    if (this.sesionStore.sesion() === null) {
      return;
    }
    // Cierra también la sesión del servidor: una expulsión por inactividad no debe poder renovarse.
    this.revocarEnServidor();
    this.sesionStore.limpiar();
    if (motivo === 'revocada') {
      this.notificaciones.advertencia(
        'Tu sesión se cerró',
        'Ya no es válida (por ejemplo, porque se cambió tu contraseña). Vuelve a iniciar sesión.',
      );
    } else {
      this.notificaciones.advertencia('Sesión expirada', 'Se cerró por inactividad o por tiempo máximo. Vuelve a iniciar sesión.');
    }
    const url = this.router.url;
    if (!url.startsWith(CONFIG.rutas.login)) {
      void this.router.navigate([CONFIG.rutas.login], { queryParams: { returnUrl: url } });
    }
  }

  tienePermiso(permiso: string): boolean {
    return this.sesionStore.tienePermiso(permiso);
  }
}
