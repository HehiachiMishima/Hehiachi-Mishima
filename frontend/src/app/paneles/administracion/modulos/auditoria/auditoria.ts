import { Component, ElementRef, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { finalize } from 'rxjs';
import {
  ACCIONES_AUDITORIA,
  ACCIONES_PRIVILEGIO,
  ENTIDADES_AUDITORIA,
  GRUPOS_ACCIONES,
  LIMITE_EXPORTACION,
  RANGOS_AUDITORIA,
  RANGO_POR_DEFECTO,
  RESULTADOS_AUDITORIA,
  RangoAuditoria,
  actorDeEvento,
  etiquetaAccion,
  etiquetaEntidad,
  inicioDeRango,
  objetivoDeEvento,
} from '../../../../core/config/auditoria';
import { idCorrelacionDe, mensajeDeError } from '../../../../core/errors/error.util';
import { AuditoriaEvento, FiltroAuditoria } from '../../../../core/models';
import { Anunciador } from '../../../../core/services/anunciador';
import { AuditoriaApi } from '../../../../core/services/auditoria.api';
import { DirectorioUsuarios } from '../../../../core/services/directorio-usuarios';
import { Notificaciones } from '../../../../core/services/notificaciones';
import { FechaHoraPipe } from '../../../../shared/pipes/fecha-hora.pipe';
import { Confirmacion } from '../../../../shared/ui/confirmacion/confirmacion';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../../shared/ui/icon/icon';
import { PANEL_ACTUAL } from '../../../panel-actual';
import { Modal } from '../../../../shared/ui/modal/modal';
import { Paginador } from '../../../../shared/ui/paginador/paginador';
import { guardarArchivo, nombreDeArchivo } from '../../../../shared/util/descarga';
import { crearEstadoUrl, numeroUrl, opcionUrl, textoUrl } from '../../../../shared/util/estado-url';
import { aFecha, isoUtc, zonaHoraria } from '../../../../shared/util/fechas';
import { formatearLogin, formatearNumero } from '../../../../shared/util/formato';
import { Button } from '../../../../shared/ui/button/button';
import { Badge } from '../../../../shared/ui/badge/badge';
import { PageHeader } from '../../../../shared/ui/page-header/page-header';
import { Notice } from '../../../../shared/ui/notice/notice';

interface GrupoDia {
  clave: string;
  titulo: string;
  eventos: AuditoriaEvento[];
}

interface FilaDiferencia {
  campo: string;
  antes: string;
  despues: string;
  cambiado: boolean;
}

const NAVEGADORES: [string, RegExp][] = [
  ['Edge', /Edg\/(\d+)/],
  ['Firefox', /Firefox\/(\d+)/],
  ['Chrome', /Chrome\/(\d+)/],
  ['Safari', /Version\/(\d+).*Safari/],
];

const SISTEMAS: [string, RegExp][] = [
  ['Windows', /Windows/],
  ['Android', /Android/],
  ['iOS', /iPhone|iPad/],
  ['macOS', /Mac OS X|Macintosh/],
  ['Linux', /Linux/],
];

const DIA = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short' });
const HORA = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Vistas guardadas: atajos a filtros frecuentes. */
const VISTAS: Record<string, { etiqueta: string; filtros: Record<string, string | null> }> = {
  'fallos-login': { etiqueta: 'Fallos de inicio de sesión (24 h)', filtros: { accion: 'LOGIN_FALLIDO', rango: '24h', resultado: null } },
  denegados: { etiqueta: 'Accesos denegados', filtros: { accion: null, resultado: 'DENEGADO', rango: '7d' } },
  privilegios: {
    etiqueta: 'Cambios de privilegios',
    filtros: { accion: ACCIONES_PRIVILEGIO.join(','), resultado: null, rango: '7d' },
  },
};

@Component({
  selector: 'app-auditoria',
  imports: [Icon, Modal, Confirmacion, EmptyState, Paginador, FechaHoraPipe, Button, Badge, PageHeader, Notice],
  templateUrl: './auditoria.html',
  styleUrl: './auditoria.scss',
})
export class Auditoria {
  /** Panel al que pertenece el módulo (antetítulo de la cabecera). */
  readonly panel = inject(PANEL_ACTUAL);
  private readonly auditoriaApi = inject(AuditoriaApi);
  private readonly notificaciones = inject(Notificaciones);
  private readonly anunciador = inject(Anunciador);
  private readonly directorio = inject(DirectorioUsuarios);
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly estadoUrl = crearEstadoUrl();

  // Estado en la URL (enlaces compartibles desde el Resumen y los historiales).
  readonly rango = input<RangoAuditoria, unknown>(RANGO_POR_DEFECTO, {
    transform: opcionUrl<RangoAuditoria>(['hoy', '24h', '7d', '30d', 'personalizado'], RANGO_POR_DEFECTO),
  });
  readonly desde = input('', { transform: textoUrl });
  readonly hasta = input('', { transform: textoUrl });
  readonly accion = input('', { transform: textoUrl });
  readonly entidad = input('', { transform: textoUrl });
  readonly entidadId = input('', { transform: textoUrl });
  readonly resultado = input('', { transform: textoUrl });
  readonly actorId = input(0, { transform: numeroUrl(0) });
  readonly q = input('', { transform: textoUrl });
  readonly relacionadoCon = input('', { transform: textoUrl });
  readonly vista = input('', { transform: textoUrl });
  readonly pagina = input(1, { transform: numeroUrl(1) });
  readonly tamano = input(25, { transform: numeroUrl(25) });
  readonly evento = input(0, { transform: numeroUrl(0) });
  readonly textoBusqueda = linkedSignal(() => this.q());

  readonly rangos = RANGOS_AUDITORIA;
  readonly resultados = Object.entries(RESULTADOS_AUDITORIA).map(([id, valor]) => ({ id, ...valor }));
  readonly entidades = Object.entries(ENTIDADES_AUDITORIA).map(([id, etiqueta]) => ({ id, etiqueta }));
  readonly vistas = Object.entries(VISTAS).map(([id, vista]) => ({ id, etiqueta: vista.etiqueta }));
  readonly zona = zonaHoraria();
  readonly opcionesTamano = [25, 50, 100] as const;
  readonly usuariosDirectorio = this.directorio.lista;

  readonly etiquetaAccion = etiquetaAccion;
  readonly etiquetaEntidad = etiquetaEntidad;
  readonly actor = actorDeEvento;
  readonly objetivo = objetivoDeEvento;

  readonly catalogoAcciones = signal<string[]>(Object.keys(ACCIONES_AUDITORIA));
  readonly gruposAcciones = computed(() => {
    const disponibles = new Set(this.catalogoAcciones());
    const agrupadas = new Set(GRUPOS_ACCIONES.flatMap((grupo) => grupo.acciones));
    const grupos = GRUPOS_ACCIONES.map((grupo) => ({
      nombre: grupo.nombre,
      acciones: grupo.acciones.filter((accion) => disponibles.has(accion)),
    }));
    const otras = [...disponibles].filter((accion) => !agrupadas.has(accion));
    return [...grupos, { nombre: 'Otras', acciones: otras }].filter((grupo) => grupo.acciones.length);
  });

  readonly cargando = signal(true);
  /** Presentación: panel de filtros desplegado (solo se pliega en móvil). */
  readonly filtrosAbiertos = signal(false);
  readonly error = signal<{ mensaje: string; idCorrelacion: string | null } | null>(null);
  readonly eventos = signal<AuditoriaEvento[]>([]);
  readonly total = signal(0);
  readonly exportando = signal(false);
  readonly confirmarExportacion = signal(false);

  /** Filtros activos traducidos al contrato de GET /auditoria. */
  readonly filtro = computed<FiltroAuditoria>(() => {
    const rango = this.rango() || RANGO_POR_DEFECTO;
    const inicio = rango === 'personalizado' ? aFecha(this.desde()) : inicioDeRango(rango);
    const fin = rango === 'personalizado' ? aFecha(this.hasta()) : null;
    return {
      pagina: this.pagina(),
      tamano: Math.min(this.tamano(), 100),
      desde: inicio ? isoUtc(inicio) : undefined,
      hasta: fin ? isoUtc(fin) : undefined,
      actorId: this.actorId() || undefined,
      accion: this.accion() || undefined,
      entidad: this.entidad() || undefined,
      entidadId: this.entidadId() || undefined,
      resultado: this.resultado() || undefined,
      q: this.q() || undefined,
      relacionadoCon: this.relacionadoCon() || undefined,
    };
  });

  readonly hayFiltros = computed(
    () =>
      !!(this.accion() || this.entidad() || this.entidadId() || this.resultado() || this.actorId() || this.q() || this.relacionadoCon()) ||
      (this.rango() || RANGO_POR_DEFECTO) !== RANGO_POR_DEFECTO,
  );

  readonly totalTexto = computed(() => formatearNumero(this.total()) + (this.totalTopado() ? '+' : ''));
  /** El backend topa el total en 50 000: más allá solo se informa "50 000+". */
  readonly totalTopado = computed(() => this.total() >= LIMITE_EXPORTACION);
  readonly actorFiltrado = computed(() => {
    const id = this.actorId();
    return id ? (this.directorio.nombre(id) ? formatearLogin(this.directorio.nombre(id)) : `Usuario #${id}`) : '';
  });

  readonly grupos = computed<GrupoDia[]>(() => {
    const grupos: GrupoDia[] = [];
    for (const evento of this.eventos()) {
      const fecha = aFecha(evento.ocurridoEn, true);
      const clave = fecha ? fecha.toDateString() : 'sin-fecha';
      let grupo = grupos.find((item) => item.clave === clave);
      if (!grupo) {
        grupo = { clave, titulo: this.tituloDia(fecha), eventos: [] };
        grupos.push(grupo);
      }
      grupo.eventos.push(evento);
    }
    return grupos;
  });

  // --- Detalle ---
  readonly detalle = signal<AuditoriaEvento | null>(null);
  readonly mostrarTodos = signal(false);
  readonly diferencias = computed<FilaDiferencia[]>(() => {
    const detalle = this.detalle()?.detalle;
    if (!detalle || (!detalle.antes && !detalle.despues)) {
      return [];
    }
    const antes = detalle.antes ?? {};
    const despues = detalle.despues ?? {};
    const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];
    const filas = campos.map((campo) => {
      const a = this.valorLegible(antes[campo]);
      const d = this.valorLegible(despues[campo]);
      return { campo, antes: a, despues: d, cambiado: a !== d };
    });
    return this.mostrarTodos() ? filas : filas.filter((fila) => fila.cambiado);
  });
  readonly detalleTecnico = computed(() => JSON.stringify(this.detalle()?.detalle ?? null, null, 2));

  constructor() {
    this.directorio.cargar();
    this.auditoriaApi.catalogo().subscribe({
      next: (catalogo) => {
        if (catalogo.acciones?.length) {
          this.catalogoAcciones.set(catalogo.acciones);
        }
      },
      // Sin catálogo se usa el listado local de acciones.
      error: () => undefined,
    });

    // Vista guardada: se expande a filtros concretos y se quita de la URL.
    effect(() => {
      const vista = VISTAS[this.vista()];
      if (vista) {
        untracked(() => this.estadoUrl.fijar({ ...vista.filtros, vista: null, pagina: null }));
      }
    });

    effect(() => {
      const filtro = this.filtro();
      if (!VISTAS[this.vista()]) {
        untracked(() => this.cargar(filtro));
      }
    });

    effect(() => {
      const id = this.evento();
      untracked(() => this.sincronizarDetalle(id));
    });
  }

  recargar(): void {
    this.cargar(this.filtro());
  }

  private cargar(filtro: FiltroAuditoria): void {
    this.cargando.set(true);
    this.error.set(null);
    this.auditoriaApi
      .buscar(filtro)
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (pagina) => {
          this.eventos.set(pagina.contenido ?? []);
          this.total.set(pagina.total ?? 0);
          this.anunciador.anunciar(`${formatearNumero(pagina.total ?? 0)} eventos`);
          this.sincronizarDetalle(this.evento());
        },
        error: (err: unknown) => {
          this.eventos.set([]);
          this.total.set(0);
          this.error.set({ mensaje: mensajeDeError(err), idCorrelacion: idCorrelacionDe(err) });
        },
      });
  }

  // --- Filtros ---
  fijar(cambios: Record<string, string | number | null>): void {
    this.estadoUrl.fijar({ ...cambios, pagina: null });
  }

  buscar(valor: string): void {
    this.textoBusqueda.set(valor);
    this.estadoUrl.fijar({ q: valor.trim(), pagina: null }, true);
  }

  cambiarRango(rango: RangoAuditoria): void {
    this.fijar(rango === 'personalizado' ? { rango } : { rango: rango === RANGO_POR_DEFECTO ? null : rango, desde: null, hasta: null });
  }

  filtrarActor(login: string): void {
    const encontrado = this.usuariosDirectorio().find((usuario) => formatearLogin(usuario.usuario) === login || usuario.usuario === login);
    if (encontrado || !login) {
      this.fijar({ actorId: encontrado?.id ?? null });
    }
  }

  aplicarVista(id: string): void {
    const vista = VISTAS[id];
    if (vista) {
      this.fijar(vista.filtros);
    }
  }

  limpiarFiltros(): void {
    this.textoBusqueda.set('');
    this.estadoUrl.fijar({
      rango: null, desde: null, hasta: null, accion: null, entidad: null, entidadId: null,
      resultado: null, actorId: null, q: null, relacionadoCon: null, pagina: null,
    });
  }

  ampliar(): void {
    this.fijar({ rango: '30d', desde: null, hasta: null });
  }

  irAPagina(pagina: number): void {
    this.estadoUrl.fijar({ pagina: pagina > 1 ? pagina : null });
  }

  cambiarTamano(tamano: number): void {
    this.estadoUrl.fijar({ tamano: tamano !== 25 ? tamano : null, pagina: null });
  }

  // --- Detalle ---
  abrir(evento: AuditoriaEvento): void {
    this.detalle.set(evento);
    this.estadoUrl.fijar({ evento: evento.id });
  }

  cerrarDetalle(): void {
    this.estadoUrl.fijar({ evento: null });
  }

  private sincronizarDetalle(id: number): void {
    this.mostrarTodos.set(false);
    if (!id) {
      this.detalle.set(null);
      return;
    }
    const enPagina = this.eventos().find((evento) => evento.id === id);
    if (enPagina) {
      this.detalle.set(enPagina);
    } else if (this.detalle()?.id !== id) {
      this.auditoriaApi.obtener(id).subscribe({
        next: (evento) => this.detalle.set(evento),
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudo abrir el evento', err),
      });
    }
  }

  /** Flechas ↑/↓ recorren las filas; Enter abre el detalle (botón de la fila). */
  moverFoco(evento: KeyboardEvent): void {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') {
      return;
    }
    const botones = Array.from(this.anfitrion.nativeElement.querySelectorAll<HTMLElement>('[data-fila-evento]'));
    const actual = botones.indexOf(document.activeElement as HTMLElement);
    if (actual === -1) {
      return;
    }
    evento.preventDefault();
    const destino = botones[Math.min(Math.max(actual + (evento.key === 'ArrowDown' ? 1 : -1), 0), botones.length - 1)];
    destino?.focus();
  }

  verHistorialEntidad(evento: AuditoriaEvento): void {
    const directa = evento.entidad && ['USUARIO', 'ROL', 'PERMISO'].includes(evento.entidad);
    this.fijar(
      directa
        ? { relacionadoCon: `${evento.entidad}:${evento.entidadId}`, entidad: null, entidadId: null, evento: null }
        : { entidad: evento.entidad, entidadId: evento.entidadId, relacionadoCon: null, evento: null },
    );
  }

  verActor(evento: AuditoriaEvento): void {
    if (evento.actorId !== null) {
      this.fijar({ actorId: evento.actorId, evento: null });
    }
  }

  verPeticion(idCorrelacion: string): void {
    this.textoBusqueda.set(idCorrelacion);
    this.fijar({ q: idCorrelacion, evento: null });
  }

  copiar(texto: string): void {
    navigator.clipboard?.writeText(texto).then(
      () => this.notificaciones.info('Copiado', 'Identificador de la petición copiado al portapapeles.'),
      () => this.notificaciones.advertencia('No se pudo copiar', texto),
    );
  }

  tono(resultado: string): string {
    return RESULTADOS_AUDITORIA[resultado]?.tono ?? 'neutral';
  }

  iconoResultado(resultado: string): string {
    return RESULTADOS_AUDITORIA[resultado]?.icono ?? 'info';
  }

  textoResultado(resultado: string): string {
    return RESULTADOS_AUDITORIA[resultado]?.etiqueta ?? resultado;
  }

  hora(valor: string): string {
    const fecha = aFecha(valor, true);
    return fecha ? HORA.format(fecha) : '—';
  }

  /** "Chrome 130 · macOS" a partir del user agent (el completo va en el tooltip). */
  navegador(userAgent: string | null): string {
    if (!userAgent) {
      return '—';
    }
    const version = NAVEGADORES.map(([nombre, patron]) => [nombre, patron.exec(userAgent)?.[1]] as const).find(([, v]) => v);
    const sistema = SISTEMAS.find(([, patron]) => patron.test(userAgent))?.[0];
    const cliente = version ? `${version[0]} ${version[1]}` : 'Otro cliente';
    return sistema ? `${cliente} · ${sistema}` : cliente;
  }

  // --- Exportación ---
  exportar(): void {
    if (this.totalTopado() && !this.confirmarExportacion()) {
      this.confirmarExportacion.set(true);
      return;
    }
    this.confirmarExportacion.set(false);
    if (this.exportando()) {
      return;
    }
    this.exportando.set(true);
    this.auditoriaApi
      .exportar(this.filtro())
      .pipe(finalize(() => this.exportando.set(false)))
      .subscribe({
        next: (respuesta) => {
          if (respuesta.body) {
            const fecha = new Date().toISOString().slice(0, 10);
            guardarArchivo(respuesta.body, nombreDeArchivo(respuesta, `auditoria-${fecha}.csv`));
            this.notificaciones.exito('Exportación lista', 'El archivo CSV se descargó con los filtros activos.');
          }
        },
        error: (err: unknown) => this.notificaciones.errorHttp('No se pudo exportar', err),
      });
  }

  readonly limiteExportacion = formatearNumero(LIMITE_EXPORTACION);

  private tituloDia(fecha: Date | null): string {
    if (!fecha) {
      return 'Sin fecha';
    }
    const hoy = new Date();
    const ayer = new Date(hoy.getTime() - 86_400_000);
    if (fecha.toDateString() === hoy.toDateString()) {
      return 'Hoy';
    }
    if (fecha.toDateString() === ayer.toDateString()) {
      return 'Ayer';
    }
    const texto = DIA.format(fecha);
    return texto[0].toUpperCase() + texto.slice(1);
  }

  private valorLegible(valor: unknown): string {
    if (valor === undefined || valor === null || valor === '') {
      return '—';
    }
    if (typeof valor === 'boolean') {
      return valor ? 'Sí' : 'No';
    }
    return typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  }
}
