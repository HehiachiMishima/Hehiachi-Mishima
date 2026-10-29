import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, finalize, forkJoin, map, of } from 'rxjs';
import {
  ACCIONES_PRIVILEGIO,
  RangoAuditoria,
  actorDeEvento,
  etiquetaAccion,
  inicioDeRango,
  objetivoDeEvento,
} from '../../../../../core/config/auditoria';
import { CONFIG } from '../../../../../core/config/configuracion';
import { PANEL_ADMIN, PANELES } from '../../../../../core/config/paneles';
import { PERMISOS, etiquetaPermiso } from '../../../../../core/config/permisos';
import { AnaliticaAdmin, AuditoriaEvento, FiltroAuditoria } from '../../../../../core/models';
import { AnaliticaApi } from '../../../../../core/services/analitica.api';
import { AuditoriaApi } from '../../../../../core/services/auditoria.api';
import { Auth } from '../../../../../core/services/auth';
import { FechaHoraPipe } from '../../../../../shared/pipes/fecha-hora.pipe';
import { BarChart, BarraDato } from '../../../../../shared/ui/charts/bar-chart';
import { BarraHorizontal, BarrasHorizontales } from '../../../../../shared/ui/charts/barras-horizontales';
import { Icon } from '../../../../../shared/ui/icon/icon';
import { fechaRelativa, isoUtc } from '../../../../../shared/util/fechas';
import { formatearNumero, porcentaje } from '../../../../../shared/util/formato';

type Tono = 'brand' | 'success' | 'warning' | 'danger';

interface Kpi {
  id: string;
  etiqueta: string;
  icono: string;
  valor: string;
  detalle: string;
  tono: Tono;
  enlace?: { ruta: string; params?: Record<string, string>; texto: string };
}

/** Indicador de la bitácora: null mientras carga; NaN si no está disponible. */
interface KpiAuditoria {
  id: string;
  etiqueta: string;
  icono: string;
  rango: RangoAuditoria;
  acciones: string[];
  valor: number | null;
}

const MES = new Intl.DateTimeFormat('es', { month: 'short', year: '2-digit' });

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink, Icon, BarChart, BarrasHorizontales, FechaHoraPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly auth = inject(Auth);
  private readonly analiticaApi = inject(AnaliticaApi);
  private readonly auditoriaApi = inject(AuditoriaApi);

  readonly usuario = this.auth.usuario;
  readonly panelRuta = PANEL_ADMIN.ruta;
  readonly rutaAuditoria = CONFIG.rutas.auditoria;
  readonly puedeAuditoria = computed(() => this.auth.permisos().includes(PERMISOS.VER_AUDITORIA));

  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly datos = signal<AnaliticaAdmin | null>(null);
  readonly actualizadoEn = signal<Date | null>(null);
  private readonly ahora = signal(Date.now());

  readonly kpisAuditoria = signal<KpiAuditoria[]>([]);
  readonly eventosSeguridad = signal<AuditoriaEvento[] | null>(null);

  readonly etiquetaAccion = etiquetaAccion;
  readonly actor = actorDeEvento;
  readonly objetivo = objetivoDeEvento;

  readonly hace = computed(() => {
    this.ahora();
    const fecha = this.actualizadoEn();
    return fecha ? fechaRelativa(fecha) : '';
  });

  readonly saludo = computed(() => {
    const hora = new Date(this.ahora()).getHours();
    return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  });

  readonly kpis = computed<Kpi[]>(() => {
    const k = this.datos()?.kpis;
    if (!k) {
      return [];
    }
    const excepciones = k.overridesGrant + k.overridesDeny;
    const lista: Kpi[] = [
      {
        id: 'activas',
        etiqueta: 'Cuentas activas',
        icono: 'usuarios',
        valor: formatearNumero(k.usuariosActivos),
        detalle: `de ${formatearNumero(k.usuarios)} · ${porcentaje(k.usuariosActivos, k.usuarios)} %`,
        tono: 'brand',
        enlace: { ruta: `${this.panelRuta}/usuarios`, params: { estado: 'activos' }, texto: 'Ver cuentas' },
      },
      {
        id: 'sin-rol',
        etiqueta: 'Cuentas sin rol',
        icono: 'alertTriangle',
        valor: formatearNumero(k.usuariosSinRol),
        detalle: k.usuariosSinRol > 0 ? 'Sin acceso o solo con ajustes individuales' : 'Todas las cuentas tienen rol',
        tono: k.usuariosSinRol > 0 ? 'warning' : 'success',
        enlace: k.usuariosSinRol > 0 ? { ruta: `${this.panelRuta}/usuarios`, params: { sinRol: '1' }, texto: 'Revisar cuentas' } : undefined,
      },
      {
        id: 'excepciones',
        etiqueta: 'Excepciones individuales',
        icono: 'key',
        valor: formatearNumero(excepciones),
        detalle: `${k.overridesGrant} ${k.overridesGrant === 1 ? 'concesión' : 'concesiones'} · ${k.overridesDeny} ${k.overridesDeny === 1 ? 'denegación' : 'denegaciones'}`,
        tono: k.overridesGrant > 0 ? 'warning' : 'brand',
      },
      {
        id: 'roles',
        etiqueta: 'Roles activos',
        icono: 'roles',
        valor: formatearNumero(k.rolesActivos),
        detalle: `de ${formatearNumero(k.roles)}`,
        tono: 'brand',
      },
      {
        id: 'permisos',
        etiqueta: 'Permisos activos',
        icono: 'permisos',
        valor: formatearNumero(k.permisosActivos),
        detalle: `de ${formatearNumero(k.permisos)}`,
        tono: 'brand',
      },
    ];
    return lista;
  });

  readonly usuariosPorRol = computed<BarraHorizontal[]>(() =>
    [...(this.datos()?.usuariosPorRol ?? [])]
      .sort((a, b) => b.valor - a.valor)
      .map((fila) => ({ etiqueta: fila.etiqueta, valor: fila.valor, apagada: fila.valor === 0 })),
  );

  readonly permisosExtendidos = computed<BarraHorizontal[]>(() =>
    (this.datos()?.permisosMasOtorgados ?? [])
      .slice(0, 12)
      .map((fila) => ({ etiqueta: etiquetaPermiso(fila.etiqueta), secundario: fila.etiqueta, valor: fila.valor })),
  );

  readonly altas = computed<BarraDato[]>(() =>
    (this.datos()?.altasPorMes ?? []).map((punto) => ({
      etiqueta: this.mes(punto.periodo),
      valor: punto.valor,
      color: 'var(--chart-1)',
      detalle: `${punto.secundario} siguen activas`,
    })),
  );

  /** Cobertura solo de los paneles que existen en el frontend. */
  readonly cobertura = computed(() => {
    const filas = this.datos()?.coberturaPaneles ?? [];
    return PANELES.map((panel) => ({
      nombre: panel.nombre,
      valor: filas.find((fila) => fila.etiqueta === panel.permiso || fila.etiqueta === panel.nombre)?.valor ?? null,
    })).filter((fila) => fila.valor !== null);
  });

  readonly modulos = computed(() =>
    PANEL_ADMIN.modulos.filter((modulo) => modulo.id !== 'dashboard' && this.auth.permisos().includes(modulo.permiso)),
  );

  constructor() {
    const reloj = setInterval(() => this.ahora.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.analiticaApi
      .admin()
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (datos) => {
          this.datos.set(datos);
          this.actualizadoEn.set(new Date());
        },
        error: () => this.error.set(true),
      });
    if (this.puedeAuditoria()) {
      this.cargarAuditoria();
    }
  }

  enlaceAuditoria(kpi: KpiAuditoria): Record<string, string> {
    return kpi.acciones.length === 1 ? { accion: kpi.acciones[0], rango: kpi.rango } : { vista: 'privilegios', rango: kpi.rango };
  }

  valorAuditoria(kpi: KpiAuditoria): string {
    return kpi.valor === null ? '' : Number.isNaN(kpi.valor) ? 'No disponible' : formatearNumero(kpi.valor);
  }

  private cargarAuditoria(): void {
    const definiciones: Omit<KpiAuditoria, 'valor'>[] = [
      { id: 'fallidos', etiqueta: 'Inicios de sesión fallidos (24 h)', icono: 'alertTriangle', rango: '24h', acciones: ['LOGIN_FALLIDO'] },
      { id: 'denegados', etiqueta: 'Accesos denegados (7 días)', icono: 'lock', rango: '7d', acciones: ['ACCESO_DENEGADO'] },
      { id: 'privilegios', etiqueta: 'Cambios de privilegios (7 días)', icono: 'shieldCheck', rango: '7d', acciones: ACCIONES_PRIVILEGIO },
    ];
    this.kpisAuditoria.set(definiciones.map((definicion) => ({ ...definicion, valor: null })));
    for (const definicion of definiciones) {
      this.contar(definicion.acciones, definicion.rango).subscribe((valor) =>
        this.kpisAuditoria.update((lista) => lista.map((kpi) => (kpi.id === definicion.id ? { ...kpi, valor } : kpi))),
      );
    }

    const ultimos = (resultado: string): Observable<AuditoriaEvento[]> =>
      this.auditoriaApi.buscar({ resultado, pagina: 1, tamano: 5 }).pipe(map((pagina) => pagina.contenido ?? []));
    this.eventosSeguridad.set(null);
    forkJoin([ultimos('FALLO'), ultimos('DENEGADO')])
      .pipe(catchError(() => of([[], []] as AuditoriaEvento[][])))
      .subscribe(([fallos, denegados]) =>
        this.eventosSeguridad.set(
          [...fallos, ...denegados].sort((a, b) => b.ocurridoEn.localeCompare(a.ocurridoEn)).slice(0, 5),
        ),
      );
  }

  /** Total de eventos (lee `total` con tamano=1); suma varias acciones. NaN si falla. */
  private contar(acciones: string[], rango: RangoAuditoria): Observable<number> {
    const desde = inicioDeRango(rango);
    const filtro = (accion: string): FiltroAuditoria => ({
      accion,
      desde: desde ? isoUtc(desde) : undefined,
      pagina: 1,
      tamano: 1,
    });
    return forkJoin(acciones.map((accion) => this.auditoriaApi.buscar(filtro(accion)).pipe(map((pagina) => pagina.total)))).pipe(
      map((totales) => totales.reduce((suma, total) => suma + total, 0)),
      catchError(() => of(Number.NaN)),
    );
  }

  private mes(periodo: string): string {
    const [anio, mes] = periodo.split('-').map(Number);
    return anio && mes ? MES.format(new Date(anio, mes - 1, 1)) : periodo;
  }
}
