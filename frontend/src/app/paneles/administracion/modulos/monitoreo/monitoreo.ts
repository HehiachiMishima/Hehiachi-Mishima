import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { PERMISOS } from '../../../../core/config/permisos';
import {
  EstadoSistema,
  IncidenciasMonitoreo,
  PeticionTraza,
  PresenciaUsuario,
  PuntoMonitoreo,
  ResumenMonitoreo,
  RutaMonitoreo,
} from '../../../../core/models';
import { Auth } from '../../../../core/services/auth';
import { MonitoreoApi } from '../../../../core/services/monitoreo.api';
import { FechaHoraPipe } from '../../../../shared/pipes/fecha-hora.pipe';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { Badge } from '../../../../shared/ui/badge/badge';
import { Button } from '../../../../shared/ui/button/button';
import { ComponenteSerie, PuntoSerie, SerieTemporal } from '../../../../shared/ui/charts/serie-temporal';
import { Icon } from '../../../../shared/ui/icon/icon';
import { Notice } from '../../../../shared/ui/notice/notice';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { Segmented, SegmentedOption } from '../../../../shared/ui/segmented/segmented';
import { fechaRelativa } from '../../../../shared/util/fechas';
import { formatearLogin, formatearNumero } from '../../../../shared/util/formato';
import { PANEL_ACTUAL } from '../../../panel-actual';
import { urlModuloPorId } from '../../../registro';

type Ventana = '5' | '15' | '60';
type Tono = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
type OrdenRutas = 'peticiones' | 'p95' | 'errores';
type TipoIncidencia = 'errores' | 'lentas';

/** Indicador de una celda: valor grande, detalle y tono opcional del badge. */
interface Celda {
  id: string;
  etiqueta: string;
  icono: string;
  valor: string;
  detalle: string;
  badge?: { tono: Tono; texto: string };
  /** Uso 0..100 para la barra de progreso (pool, memoria, CPU). */
  uso?: number;
}

const INTERVALO_MS = 15_000;
const HORA = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

const ESTADOS: Record<EstadoSistema, { tono: 'success' | 'warning' | 'danger'; titulo: string; texto: string }> = {
  OPERATIVO: { tono: 'success', titulo: 'Operativo', texto: 'La API, la base de datos y la aplicación responden con normalidad.' },
  DEGRADADO: { tono: 'warning', titulo: 'Degradado', texto: 'El sistema responde, pero hay indicadores fuera de lo normal.' },
  CAIDO: { tono: 'danger', titulo: 'Caído', texto: 'La base de datos no responde: la mayoría de las operaciones fallarán.' },
};

/**
 * Monitoreo administrativo en vivo: semáforo, tráfico, latencias, errores,
 * infraestructura (BD, pool, memoria, CPU, colas), endpoints, incidencias y
 * usuarios conectados. Se refresca cada 15 s mientras la pestaña está visible.
 */
@Component({
  selector: 'app-monitoreo',
  imports: [RouterLink, Avatar, Icon, Button, Badge, Notice, PageHeader, Segmented, SerieTemporal, FechaHoraPipe],
  templateUrl: './monitoreo.html',
  styleUrl: './monitoreo.scss',
})
export class Monitoreo {
  readonly panel = inject(PANEL_ACTUAL);
  private readonly api = inject(MonitoreoApi);
  private readonly auth = inject(Auth);

  readonly rutaActividad = urlModuloPorId('actividad');
  readonly rutaAuditoria = urlModuloPorId('auditoria');
  readonly puedeAuditoria = computed(() => this.auth.permisos().includes(PERMISOS.VER_AUDITORIA));
  readonly formatearLogin = formatearLogin;

  readonly opcionesVentana: SegmentedOption<Ventana>[] = [
    { value: '5', label: '5 min' },
    { value: '15', label: '15 min' },
    { value: '60', label: '1 h' },
  ];
  readonly opcionesIncidencia: SegmentedOption<TipoIncidencia>[] = [
    { value: 'errores', label: 'Errores' },
    { value: 'lentas', label: 'Lentas' },
  ];
  readonly opcionesOrden: SegmentedOption<OrdenRutas>[] = [
    { value: 'peticiones', label: 'Más usadas' },
    { value: 'p95', label: 'Más lentas' },
    { value: 'errores', label: 'Con errores' },
  ];

  readonly ventana = signal<Ventana>('15');
  readonly tipoIncidencia = signal<TipoIncidencia>('errores');
  readonly ordenRutas = signal<OrdenRutas>('peticiones');
  readonly pausado = signal(false);

  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly resumen = signal<ResumenMonitoreo | null>(null);
  readonly serie = signal<PuntoMonitoreo[]>([]);
  readonly rutas = signal<RutaMonitoreo[]>([]);
  readonly incidencias = signal<IncidenciasMonitoreo | null>(null);
  readonly presentes = signal<PresenciaUsuario[]>([]);
  readonly actualizadoEn = signal<Date | null>(null);
  private readonly ahora = signal(Date.now());

  readonly hace = computed(() => {
    this.ahora();
    const fecha = this.actualizadoEn();
    return fecha ? fechaRelativa(fecha) : '';
  });

  readonly estado = computed(() => {
    const r = this.resumen();
    return r ? ESTADOS[r.sistema.estado] : null;
  });

  readonly trafico = computed<Celda[]>(() => {
    const r = this.resumen();
    if (!r) {
      return [];
    }
    const v = r.ventana;
    const lento = this.incidencias()?.umbralLentoMs ?? 1000;
    return [
      {
        id: 'peticiones',
        etiqueta: 'Peticiones',
        icono: 'activity',
        valor: formatearNumero(v.peticiones),
        detalle: `${v.porMinuto.toLocaleString('es')} por minuto`,
      },
      {
        id: 'error5xx',
        etiqueta: 'Errores del servidor (5xx)',
        icono: 'xCircle',
        valor: `${v.tasaError5xx.toLocaleString('es')} %`,
        detalle: `${formatearNumero(v.errores5xx)} de ${formatearNumero(v.peticiones)}`,
        badge: v.errores5xx === 0 ? { tono: 'success', texto: 'Correcto' } : v.tasaError5xx >= 5 ? { tono: 'danger', texto: 'Atención' } : { tono: 'warning', texto: 'Revisar' },
      },
      {
        id: 'error4xx',
        etiqueta: 'Rechazadas (4xx)',
        icono: 'alertTriangle',
        valor: formatearNumero(v.errores4xx),
        detalle: 'Validación, permisos o sesión vencida',
      },
      {
        id: 'p95',
        etiqueta: 'Latencia p95',
        icono: 'clock',
        valor: `${formatearNumero(v.p95Ms)} ms`,
        detalle: `p50 ${formatearNumero(v.p50Ms)} ms · p99 ${formatearNumero(v.p99Ms)} ms`,
        badge: v.peticiones === 0 ? undefined : v.p95Ms >= lento ? { tono: 'warning', texto: 'Lenta' } : { tono: 'success', texto: 'Correcto' },
      },
      {
        id: 'max',
        etiqueta: 'Más lenta',
        icono: 'clock',
        valor: `${formatearNumero(v.maxMs)} ms`,
        detalle: `Promedio ${formatearNumero(v.promedioMs)} ms`,
      },
      {
        id: 'activos',
        etiqueta: 'Usuarios activos',
        icono: 'usuarios',
        valor: formatearNumero(r.usuariosActivos),
        detalle: `${r.sistema.enVuelo} ${r.sistema.enVuelo === 1 ? 'petición' : 'peticiones'} en curso`,
      },
    ];
  });

  readonly infraestructura = computed<Celda[]>(() => {
    const r = this.resumen();
    if (!r) {
      return [];
    }
    const { baseDatos: bd, jvm, colas } = r.sistema;
    const celdas: Celda[] = [
      {
        id: 'bd',
        etiqueta: 'Base de datos',
        icono: 'database',
        valor: bd.disponible ? `${formatearNumero(bd.latenciaMs ?? 0)} ms` : 'Sin respuesta',
        detalle: bd.disponible
          ? `Ida y vuelta de una consulta${bd.tamanoBytes !== null ? ' · ' + bytes(bd.tamanoBytes) : ''}`
          : 'No se pudo abrir una conexión',
        badge: !bd.disponible ? { tono: 'danger', texto: 'Caída' } : (bd.latenciaMs ?? 0) >= 500 ? { tono: 'warning', texto: 'Lenta' } : { tono: 'success', texto: 'Correcto' },
      },
    ];
    if (bd.poolMaximo) {
      celdas.push({
        id: 'pool',
        etiqueta: 'Pool de conexiones',
        icono: 'layers',
        valor: `${bd.poolActivas ?? 0} / ${bd.poolMaximo}`,
        detalle: `${bd.poolInactivas ?? 0} libres · ${bd.poolEsperando ?? 0} en espera${bd.conexionesServidor !== null ? ' · ' + bd.conexionesServidor + ' en el servidor' : ''}`,
        uso: pct(bd.poolActivas ?? 0, bd.poolMaximo),
        badge: (bd.poolEsperando ?? 0) > 0 ? { tono: 'danger', texto: 'Saturado' } : undefined,
      });
    }
    const usoHeap = pct(jvm.heapUsadoBytes, jvm.heapMaxBytes);
    celdas.push(
      {
        id: 'memoria',
        etiqueta: 'Memoria (heap)',
        icono: 'server',
        valor: `${usoHeap} %`,
        detalle: `${bytes(jvm.heapUsadoBytes)} de ${bytes(jvm.heapMaxBytes)}`,
        uso: usoHeap,
        badge: usoHeap >= 90 ? { tono: 'danger', texto: 'Alta' } : usoHeap >= 75 ? { tono: 'warning', texto: 'Revisar' } : undefined,
      },
      {
        id: 'cpu',
        etiqueta: 'CPU del proceso',
        icono: 'activity',
        valor: jvm.cpuProceso < 0 ? 'N/D' : `${jvm.cpuProceso.toLocaleString('es')} %`,
        detalle: `${jvm.procesadores} ${jvm.procesadores === 1 ? 'núcleo' : 'núcleos'}${jvm.cpuSistema >= 0 ? ' · equipo ' + jvm.cpuSistema.toLocaleString('es') + ' %' : ''}`,
        uso: jvm.cpuProceso < 0 ? undefined : Math.round(jvm.cpuProceso),
      },
      {
        id: 'hilos',
        etiqueta: 'Hilos',
        icono: 'layers',
        valor: formatearNumero(jvm.hilos),
        detalle: `Pico ${formatearNumero(jvm.hilosPico)} · GC ${formatearNumero(jvm.gcConteo)} (${formatearNumero(jvm.gcTiempoMs)} ms)`,
      },
      {
        id: 'uptime',
        etiqueta: 'En marcha',
        icono: 'power',
        valor: duracion(r.sistema.uptimeSegundos),
        detalle: `Java ${jvm.version.split('+')[0]}`,
      },
      {
        id: 'colas',
        etiqueta: 'Escritura de bitácoras',
        icono: 'history',
        valor: formatearNumero(colas.auditoriaPendientes + colas.trazasPendientes),
        detalle: colas.trazasPersistidas
          ? `Pendientes · traza conservada ${colas.retencionDias} días`
          : 'Pendientes · la traza de peticiones está desactivada',
        badge:
          colas.auditoriaDescartados > 0
            ? { tono: 'danger', texto: `${colas.auditoriaDescartados} perdidos` }
            : colas.trazasDescartadas > 0
              ? { tono: 'warning', texto: `${colas.trazasDescartadas} trazas perdidas` }
              : undefined,
      },
    );
    return celdas;
  });

  readonly componentesTrafico: ComponenteSerie[] = [
    { nombre: 'Correctas', color: 'var(--color-chart-3)' },
    { nombre: '4xx', color: 'var(--color-warning)' },
    { nombre: '5xx', color: 'var(--color-danger)' },
  ];
  readonly componentesLatencia: ComponenteSerie[] = [{ nombre: 'p95', color: 'var(--color-chart-2)' }];

  readonly puntosTrafico = computed<PuntoSerie[]>(() =>
    this.serie().map((p) => ({
      etiqueta: HORA.format(new Date(p.minuto)),
      valores: [p.peticiones - p.errores4xx - p.errores5xx, p.errores4xx, p.errores5xx],
    })),
  );

  readonly puntosLatencia = computed<PuntoSerie[]>(() =>
    this.serie().map((p) => ({ etiqueta: HORA.format(new Date(p.minuto)), valores: [p.p95Ms] })),
  );

  readonly rutasOrdenadas = computed(() => {
    const lista = [...this.rutas()];
    const orden = this.ordenRutas();
    if (orden === 'p95') {
      lista.sort((a, b) => b.p95Ms - a.p95Ms);
    } else if (orden === 'errores') {
      return lista.filter((r) => r.errores4xx + r.errores5xx > 0).sort((a, b) => b.errores5xx - a.errores5xx || b.errores4xx - a.errores4xx);
    }
    return lista.slice(0, 25);
  });

  readonly listaIncidencias = computed<PeticionTraza[]>(() => {
    const i = this.incidencias();
    return (this.tipoIncidencia() === 'errores' ? i?.errores : i?.lentas)?.slice(0, 12) ?? [];
  });

  readonly tonoEstado = (estado: number): Tono => (estado >= 500 ? 'danger' : estado >= 400 ? 'warning' : 'success');
  readonly tasa = (r: RutaMonitoreo): string =>
    r.peticiones ? `${Math.round(((r.errores4xx + r.errores5xx) / r.peticiones) * 1000) / 10} %` : '0 %';
  readonly numero = formatearNumero;

  private suscripcion: { unsubscribe(): void } | null = null;

  constructor() {
    const reloj = setInterval(() => {
      this.ahora.set(Date.now());
    }, 5_000);
    const sondeo = setInterval(() => {
      if (!this.pausado() && document.visibilityState === 'visible') {
        this.cargar(true);
      }
    }, INTERVALO_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(reloj);
      clearInterval(sondeo);
      this.suscripcion?.unsubscribe();
    });
    this.cargar();
  }

  cambiarVentana(valor: Ventana): void {
    this.ventana.set(valor);
    this.cargar();
  }

  alternarPausa(): void {
    this.pausado.update((v) => !v);
    if (!this.pausado()) {
      this.cargar(true);
    }
  }

  /** `silencioso`: refresco periódico; no muestra esqueletos ni borra lo que hay. */
  cargar(silencioso = false): void {
    if (!silencioso) {
      this.cargando.set(true);
    }
    this.suscripcion?.unsubscribe();
    const minutos = Number(this.ventana());
    this.suscripcion = forkJoin({
      resumen: this.api.resumen(minutos),
      serie: this.api.serie(60).pipe(catchError(() => of(null))),
      rutas: this.api.rutas(minutos).pipe(catchError(() => of(null))),
      incidencias: this.api.incidencias().pipe(catchError(() => of(null))),
      presentes: this.api.usuariosActivos(15).pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (d) => {
          this.resumen.set(d.resumen);
          if (d.serie) this.serie.set(d.serie);
          if (d.rutas) this.rutas.set(d.rutas);
          if (d.incidencias) this.incidencias.set(d.incidencias);
          if (d.presentes) this.presentes.set(d.presentes);
          this.error.set(false);
          this.actualizadoEn.set(new Date());
        },
        error: () => this.error.set(true),
      });
  }
}

function pct(parte: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((parte / total) * 100)) : 0;
}

function bytes(valor: number): string {
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = valor;
  let i = 0;
  while (v >= 1024 && i < unidades.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toLocaleString('es', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${unidades[i]}`;
}

function duracion(segundos: number): string {
  const d = Math.floor(segundos / 86_400);
  const h = Math.floor((segundos % 86_400) / 3_600);
  const m = Math.floor((segundos % 3_600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}
