import { Component, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PERMISOS } from '../../../../core/config/permisos';
import { idCorrelacionDe, mensajeDeError } from '../../../../core/errors/error.util';
import { ActividadUsuario, FiltroPeticiones, PeticionTraza } from '../../../../core/models';
import { Auth } from '../../../../core/services/auth';
import { DirectorioUsuarios } from '../../../../core/services/directorio-usuarios';
import { MonitoreoApi } from '../../../../core/services/monitoreo.api';
import { Notificaciones } from '../../../../core/services/notificaciones';
import { UsuariosApi } from '../../../../core/services/usuarios.api';
import { FechaHoraPipe } from '../../../../shared/pipes/fecha-hora.pipe';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { BarraHorizontal, BarrasHorizontales } from '../../../../shared/ui/charts/barras-horizontales';
import { PuntoSerie, SerieTemporal } from '../../../../shared/ui/charts/serie-temporal';
import { Confirmacion } from '../../../../shared/ui/confirmacion/confirmacion';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../../shared/ui/icon/icon';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { Paginador } from '../../../../shared/ui/paginador/paginador';
import { crearEstadoUrl, numeroUrl, opcionUrl, textoUrl } from '../../../../shared/util/estado-url';
import { aFecha, isoUtc, zonaHoraria } from '../../../../shared/util/fechas';
import { formatearLogin, formatearNumero } from '../../../../shared/util/formato';
import { PANEL_ACTUAL } from '../../../panel-actual';
import { urlModuloPorId } from '../../../registro';

type Rango = '1h' | '24h' | '7d' | '30d';

const RANGOS: { id: Rango; etiqueta: string; ms: number; dias: number }[] = [
  { id: '1h', etiqueta: 'Última hora', ms: 3_600_000, dias: 1 },
  { id: '24h', etiqueta: 'Últimas 24 horas', ms: 86_400_000, dias: 1 },
  { id: '7d', etiqueta: 'Últimos 7 días', ms: 7 * 86_400_000, dias: 7 },
  { id: '30d', etiqueta: 'Últimos 30 días', ms: 30 * 86_400_000, dias: 30 },
];

const ESTADOS = [
  { id: '', etiqueta: 'Todos' },
  { id: '2xx', etiqueta: 'Correctas (2xx)' },
  { id: 'errores', etiqueta: 'Con error (4xx y 5xx)' },
  { id: '4xx', etiqueta: 'Rechazadas (4xx)' },
  { id: '401', etiqueta: 'Sin sesión (401)' },
  { id: '403', etiqueta: 'Sin permiso (403)' },
  { id: '5xx', etiqueta: 'Error del servidor (5xx)' },
];

const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const HORA = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const DIA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const NAVEGADORES: [string, RegExp][] = [
  ['Edge', /Edg\/(\d+)/],
  ['Firefox', /Firefox\/(\d+)/],
  ['Chrome', /Chrome\/(\d+)/],
  ['Safari', /Version\/(\d+).*Safari/],
];

/**
 * Traza de peticiones de la API: quién hizo qué, cuándo, desde dónde, con
 * qué resultado y cuánto tardó. Con un usuario filtrado muestra su resumen
 * (rutas, IPs, días) y permite cerrar sus sesiones.
 */
@Component({
  selector: 'app-actividad',
  imports: [
    RouterLink,
    Icon,
    Badge,
    Button,
    PageHeader,
    Paginador,
    EmptyState,
    Confirmacion,
    BarrasHorizontales,
    SerieTemporal,
    FechaHoraPipe,
  ],
  templateUrl: './actividad.html',
  styleUrl: './actividad.scss',
})
export class Actividad {
  readonly panel = inject(PANEL_ACTUAL);
  private readonly api = inject(MonitoreoApi);
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly auth = inject(Auth);
  private readonly directorio = inject(DirectorioUsuarios);
  private readonly notificaciones = inject(Notificaciones);
  private readonly estadoUrl = crearEstadoUrl();

  // Estado en la URL (enlaces desde Monitoreo y Usuarios).
  readonly rango = input<Rango, unknown>('24h', { transform: opcionUrl<Rango>(['1h', '24h', '7d', '30d'], '24h') });
  readonly actorId = input(0, { transform: numeroUrl(0) });
  readonly metodo = input('', { transform: textoUrl });
  readonly ruta = input('', { transform: textoUrl });
  readonly estado = input('', { transform: textoUrl });
  readonly lentas = input('', { transform: textoUrl });
  readonly idCorrelacion = input('', { transform: textoUrl });
  readonly pagina = input(1, { transform: numeroUrl(1) });
  readonly tamano = input(50, { transform: numeroUrl(50) });
  readonly textoCorrelacion = linkedSignal(() => this.idCorrelacion());

  readonly rangos = RANGOS;
  readonly estados = ESTADOS;
  readonly metodos = METODOS;
  readonly zona = zonaHoraria();
  readonly opcionesTamano = [25, 50, 100] as const;
  readonly usuariosDirectorio = this.directorio.lista;
  readonly formatearLogin = formatearLogin;
  readonly numero = formatearNumero;
  readonly rutaAuditoria = urlModuloPorId('auditoria');
  readonly rutaUsuarios = urlModuloPorId('usuarios');

  readonly puedeAuditoria = computed(() => this.auth.permisos().includes(PERMISOS.VER_AUDITORIA));
  readonly puedeCerrarSesiones = computed(() => this.auth.permisos().includes(PERMISOS.MODIFICAR_USUARIOS));

  readonly cargando = signal(true);
  readonly filtrosAbiertos = signal(false);
  readonly error = signal<{ mensaje: string; idCorrelacion: string | null } | null>(null);
  readonly peticiones = signal<PeticionTraza[]>([]);
  readonly total = signal(0);
  readonly seleccion = signal<PeticionTraza | null>(null);

  readonly actividad = signal<ActividadUsuario | null>(null);
  readonly cargandoActividad = signal(false);
  readonly confirmarCierre = signal(false);
  readonly cerrando = signal(false);

  readonly filtro = computed<FiltroPeticiones>(() => {
    const r = RANGOS.find((x) => x.id === this.rango()) ?? RANGOS[1];
    return {
      // Con un id de petición se busca en todo el periodo conservado.
      desde: this.idCorrelacion() ? undefined : isoUtc(new Date(Date.now() - r.ms)),
      actorId: this.actorId() || undefined,
      metodo: this.metodo() || undefined,
      ruta: this.ruta() || undefined,
      estado: this.estado() || undefined,
      minMs: this.lentas() ? 1000 : undefined,
      idCorrelacion: this.idCorrelacion() || undefined,
      pagina: this.pagina(),
      tamano: Math.min(this.tamano(), 100),
    };
  });

  readonly hayFiltros = computed(
    () => !!(this.actorId() || this.metodo() || this.ruta() || this.estado() || this.lentas() || this.idCorrelacion()) || this.rango() !== '24h',
  );

  readonly actorFiltrado = computed(() => {
    const id = this.actorId();
    if (!id) return '';
    const nombre = this.directorio.nombre(id);
    return nombre ? formatearLogin(nombre) : `Usuario #${id}`;
  });

  readonly totalTexto = computed(() => formatearNumero(this.total()) + (this.total() >= 50_000 ? '+' : ''));

  readonly rutasUsuario = computed<BarraHorizontal[]>(() =>
    (this.actividad()?.rutas ?? []).map((r) => ({ etiqueta: r.etiqueta, valor: r.valor })),
  );
  readonly ipsUsuario = computed<BarraHorizontal[]>(() =>
    (this.actividad()?.ips ?? []).map((r) => ({ etiqueta: r.etiqueta, valor: r.valor })),
  );
  readonly diasUsuario = computed<PuntoSerie[]>(() =>
    (this.actividad()?.porDia ?? []).map((d) => ({ etiqueta: DIA.format(new Date(d.etiqueta + 'T00:00:00Z')), valores: [d.valor] })),
  );
  readonly erroresUsuario = computed(() => {
    const a = this.actividad();
    return a && a.peticiones ? Math.round((a.errores / a.peticiones) * 1000) / 10 : 0;
  });

  constructor() {
    this.directorio.cargar();
    effect(() => {
      const filtro = this.filtro();
      untracked(() => this.cargar(filtro));
    });
    effect(() => {
      const id = this.actorId();
      const dias = (RANGOS.find((x) => x.id === this.rango()) ?? RANGOS[1]).dias;
      untracked(() => this.cargarActividad(id, dias));
    });
  }

  fijar(cambios: Record<string, string | number | boolean | null>, diferido = false): void {
    this.estadoUrl.fijar({ ...cambios, pagina: null }, diferido);
  }

  filtrarActor(valor: string): void {
    const login = valor.trim().replace(/^@/, '').toLowerCase();
    if (!login) {
      this.fijar({ actorId: null });
      return;
    }
    const usuario = this.usuariosDirectorio().find((u) => u.usuario.replace(/^@/, '').toLowerCase() === login);
    if (usuario) {
      this.fijar({ actorId: usuario.id });
    } else {
      this.notificaciones.advertencia('Usuario no encontrado', valor);
    }
  }

  buscarCorrelacion(valor: string): void {
    this.textoCorrelacion.set(valor);
    this.fijar({ idCorrelacion: valor.trim() || null }, true);
  }

  limpiarFiltros(): void {
    this.estadoUrl.fijar({ rango: null, actorId: null, metodo: null, ruta: null, estado: null, lentas: null, idCorrelacion: null, pagina: null });
  }

  irAPagina(pagina: number): void {
    this.estadoUrl.fijar({ pagina });
  }

  cambiarTamano(tamano: number): void {
    this.estadoUrl.fijar({ tamano, pagina: null });
  }

  recargar(): void {
    this.cargar(this.filtro());
    this.cargarActividad(this.actorId(), (RANGOS.find((x) => x.id === this.rango()) ?? RANGOS[1]).dias);
  }

  hora(valor: string): string {
    const f = aFecha(valor, true);
    return f ? HORA.format(f) : '—';
  }

  tono(estado: number): 'success' | 'warning' | 'danger' | 'neutral' {
    return estado >= 500 ? 'danger' : estado >= 400 ? 'warning' : estado >= 200 && estado < 300 ? 'success' : 'neutral';
  }

  navegador(ua: string | null): string {
    if (!ua) return '—';
    for (const [nombre, patron] of NAVEGADORES) {
      const m = ua.match(patron);
      if (m) return `${nombre} ${m[1]}`;
    }
    return ua.length > 40 ? ua.slice(0, 40) + '…' : ua;
  }

  copiar(texto: string): void {
    void navigator.clipboard?.writeText(texto).then(
      () => this.notificaciones.info('Copiado', texto),
      () => undefined,
    );
  }

  cerrarSesiones(motivo: string): void {
    const id = this.actorId();
    if (!id || this.cerrando()) return;
    this.cerrando.set(true);
    this.usuariosApi
      .cerrarSesiones(id, motivo || undefined)
      .pipe(finalize(() => this.cerrando.set(false)))
      .subscribe({
        next: () => {
          this.confirmarCierre.set(false);
          this.notificaciones.exito('Sesiones cerradas', `${this.actorFiltrado()} deberá iniciar sesión de nuevo.`);
        },
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudieron cerrar las sesiones', err),
      });
  }

  private cargar(filtro: FiltroPeticiones): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api
      .peticiones(filtro)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (p) => {
          this.peticiones.set(p.contenido ?? []);
          this.total.set(p.total ?? 0);
        },
        error: (err: unknown) => {
          this.peticiones.set([]);
          this.total.set(0);
          this.error.set({ mensaje: mensajeDeError(err), idCorrelacion: idCorrelacionDe(err) });
        },
      });
  }

  private cargarActividad(id: number, dias: number): void {
    this.actividad.set(null);
    if (!id) return;
    this.cargandoActividad.set(true);
    this.api
      .actividad(id, dias)
      .pipe(finalize(() => this.cargandoActividad.set(false)))
      .subscribe({ next: (a) => this.actividad.set(a), error: () => this.actividad.set(null) });
  }
}
