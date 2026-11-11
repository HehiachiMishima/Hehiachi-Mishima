import { useEffect, useMemo, useState } from "react";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import TokenGroup from "@cloudscape-design/components/token-group";
import { actorDeEvento, etiquetaAccion, etiquetaEntidad, LIMITE_EXPORTACION, objetivoDeEvento, resultadoDe } from "@/compartido/auditoria/etiquetas";
import type { AuditoriaEvento } from "@/compartido/auditoria/tipos";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { CategoriaAccion } from "@/compartido/componentes/Insignias";
import { ModalConfirmacion } from "@/compartido/componentes/ModalConfirmacion";
import { useDirectorioUsuarios } from "@/compartido/datos/directorio";
import { PanelDividido } from "@/compartido/marco/PanelDividido";
import { useParametrosUrl } from "@/compartido/navegacion";
import { guardarArchivo } from "@/compartido/util/descarga";
import { diaHora, fechaCompleta, numero, zonaHoraria } from "@/compartido/util/formato";
import { mensajeDeError } from "@/core/api/errores";
import { useNotificaciones } from "@/core/notificaciones/contexto";
import { DetalleEvento } from "./componentes/DetalleEvento";
import { FiltrosAuditoria } from "./componentes/FiltrosAuditoria";
import { exportarAuditoria, useEvento, useEventos } from "./consultas";
import { aConsulta, CLAVES_URL, hayFiltros, leerFiltros, VISTAS } from "./filtros";
import { InfoAyuda } from "@/compartido/marco/InfoAyuda";

const TAMANOS = [20, 50, 100];

/** Bitácora inmutable: filtros en la URL, paginación en el servidor y detalle en el panel dividido. */
export default function AuditoriaPagina() {
  const [params, cambiar] = useParametrosUrl();
  const { notificar } = useNotificaciones();
  const directorio = useDirectorioUsuarios();
  const [ancla, setAncla] = useState(() => Date.now());
  const [exportando, setExportando] = useState(false);
  const [confirmarExportar, setConfirmarExportar] = useState(false);

  // ?vista=… (desde el Resumen) se traduce a sus filtros y desaparece de la URL.
  const vista = params.get("vista");
  useEffect(() => {
    if (vista && VISTAS[vista]) cambiar({ ...Object.fromEntries(CLAVES_URL.map((c) => [c, null])), ...VISTAS[vista].filtros, vista: null }, { reemplazar: true });
  }, [vista, cambiar]);

  const filtros = useMemo(() => leerFiltros(params), [params]);
  const pagina = Math.max(1, Number(params.get("pagina")) || 1);
  const tamano = TAMANOS.includes(Number(params.get("tamano"))) ? Number(params.get("tamano")) : TAMANOS[0];
  const consulta = useEventos(aConsulta(filtros, ancla, pagina, tamano));
  const eventos = consulta.data?.contenido ?? [];
  const total = consulta.data?.total ?? 0;

  const idEvento = Number(params.get("evento")) || null;
  const enLista = eventos.find((e) => e.id === idEvento);
  const remoto = useEvento(idEvento !== null && !enLista ? idEvento : null);
  const seleccionado = enLista ?? remoto.data ?? null;

  const actualizar = () => {
    setAncla(Date.now());
    void consulta.refetch();
  };

  const abrir = (e: AuditoriaEvento) => cambiar({ evento: e.id }, { conservarPagina: true });
  const verActor = (e: AuditoriaEvento) => cambiar({ actorId: e.actorId, evento: null, rango: "30d", desde: null, hasta: null });
  const verEntidad = (e: AuditoriaEvento) => cambiar({ relacionadoCon: `${e.entidad}:${e.entidadId?.split(":")[0]}`, evento: null, rango: "30d", desde: null, hasta: null });
  const verPeticion = (id: string) => cambiar({ ...Object.fromEntries(CLAVES_URL.map((c) => [c, null])), q: id, rango: "30d", evento: null });
  const limpiar = () => cambiar({ ...Object.fromEntries(CLAVES_URL.map((c) => [c, null])), evento: null });

  const exportar = async () => {
    setConfirmarExportar(false);
    setExportando(true);
    try {
      const { contenido, nombre } = await exportarAuditoria(aConsulta(filtros, ancla, 1, 1));
      guardarArchivo(contenido, nombre ?? `auditoria-${new Date().toISOString().slice(0, 10)}.csv`);
      notificar({ type: "success", content: `Exportados ${numero(Math.min(total, LIMITE_EXPORTACION))} eventos.` });
    } catch (e) {
      notificar({ type: "error", header: "No se pudo exportar", content: mensajeDeError(e) });
    } finally {
      setExportando(false);
    }
  };

  const actor = filtros.actorId ? directorio.porId.get(filtros.actorId) : undefined;
  const fichas = [
    filtros.relacionadoCon && { clave: "relacionadoCon", label: `Relacionado con ${filtros.relacionadoCon}` },
    filtros.entidadId && { clave: "entidadId", label: `${etiquetaEntidad(filtros.entidad)} #${filtros.entidadId}` },
    filtros.actorId && { clave: "actorId", label: `Actor: ${actor ? `@${actor.usuario.replace(/^@/, "")}` : `#${filtros.actorId}`}` },
  ].filter((f): f is { clave: string; label: string } => !!f);

  return (
    <>
      <Table
        variant="full-page"
        stickyHeader
        resizableColumns
        wrapLines={false}
        items={eventos}
        trackBy="id"
        loading={consulta.isPending}
        loadingText="Cargando eventos"
        selectionType="single"
        selectedItems={seleccionado ? [seleccionado] : []}
        onSelectionChange={({ detail }) => detail.selectedItems[0] && abrir(detail.selectedItems[0])}
        ariaLabels={{ tableLabel: "Eventos de auditoría", selectionGroupLabel: "Evento seleccionado", itemSelectionLabel: (_, e) => `Ver ${etiquetaAccion(e.accion)} de ${diaHora(e.ocurridoEn)}` }}
        header={
          <Header
            variant="awsui-h1-sticky"
            info={<InfoAyuda />}
            counter={consulta.data ? `(${numero(total)})` : undefined}
            description={`Registro de solo lectura de inicios de sesión y cambios de acceso. Horas en ${zonaHoraria()}.`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" ariaLabel="Actualizar" loading={consulta.isFetching} onClick={actualizar} />
                <ButtonDropdown
                  items={Object.entries(VISTAS).map(([id, v]) => ({ id, text: v.etiqueta }))}
                  onItemClick={({ detail }) => cambiar({ vista: detail.id })}
                >
                  Vistas guardadas
                </ButtonDropdown>
                <Button
                  iconName="download"
                  loading={exportando}
                  disabled={total === 0}
                  disabledReason="No hay eventos que exportar."
                  onClick={() => (total > LIMITE_EXPORTACION ? setConfirmarExportar(true) : void exportar())}
                >
                  Exportar CSV
                </Button>
              </SpaceBetween>
            }
          >
            Auditoría
          </Header>
        }
        filter={
          <SpaceBetween size="s">
            <FiltrosAuditoria
              key={`${params.get("actorId") ?? ""}-${directorio.lista.length > 0}`}
              filtros={filtros}
              actores={directorio.lista}
              onCambio={(c) => cambiar(c)}
            />
            {(fichas.length > 0 || hayFiltros(params)) && (
              <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                {fichas.length > 0 && (
                  <TokenGroup
                    items={fichas.map((f) => ({ label: f.label, dismissLabel: `Quitar ${f.label}` }))}
                    onDismiss={({ detail }) => cambiar({ [fichas[detail.itemIndex].clave]: null })}
                  />
                )}
                <Button variant="inline-link" onClick={limpiar}>
                  Limpiar filtros
                </Button>
              </SpaceBetween>
            )}
          </SpaceBetween>
        }
        columnDefinitions={[
          { id: "fecha", header: "Fecha", cell: (e) => <span title={fechaCompleta(e.ocurridoEn)}>{diaHora(e.ocurridoEn)}</span>, width: 170 },
          {
            id: "resultado",
            header: "Resultado",
            cell: (e) => {
              const r = resultadoDe(e.resultado);
              return <StatusIndicator type={r.tipo}>{r.etiqueta}</StatusIndicator>;
            },
            width: 130,
          },
          {
            id: "accion",
            header: "Acción",
            isRowHeader: true,
            cell: (e) => (
              <Link onFollow={(ev) => (ev.preventDefault(), abrir(e))} href={`?evento=${e.id}`}>
                {etiquetaAccion(e.accion)}
              </Link>
            ),
            minWidth: 200,
          },
          {
            id: "actor",
            header: "Actor",
            cell: (e) =>
              e.actorId !== null && e.actorId !== 0 ? (
                <Link variant="secondary" href={`?actorId=${e.actorId}`} onFollow={(ev) => (ev.preventDefault(), verActor(e))} ariaLabel={`Filtrar por el actor ${actorDeEvento(e)}`}>
                  {actorDeEvento(e)}
                </Link>
              ) : (
                <Box color="text-body-secondary">{actorDeEvento(e)}</Box>
              ),
          },
          { id: "categoria", header: "Categoría", cell: (e) => <CategoriaAccion accion={e.accion} />, width: 140 },
          { id: "objetivo", header: "Objetivo", cell: (e) => objetivoDeEvento(e), minWidth: 200 },
          { id: "ip", header: "IP", cell: (e) => e.ip ?? "—" },
        ]}
        empty={
          consulta.isError ? (
            <EstadoVacio titulo="No se pudo cargar la bitácora" texto={mensajeDeError(consulta.error)} accion={<Button onClick={actualizar}>Reintentar</Button>} />
          ) : hayFiltros(params) ? (
            <EstadoVacio
              titulo="No hay eventos con estos filtros"
              texto="Amplía el periodo o quita algún filtro."
              accion={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button onClick={() => cambiar({ rango: "30d", desde: null, hasta: null })}>Ampliar a 30 días</Button>
                  <Button onClick={limpiar}>Limpiar filtros</Button>
                </SpaceBetween>
              }
            />
          ) : (
            <EstadoVacio titulo="Aún no hay eventos" texto="Los inicios de sesión y los cambios de acceso aparecerán aquí." />
          )
        }
        pagination={
          <Pagination
            currentPageIndex={pagina}
            pagesCount={Math.max(1, consulta.data?.totalPaginas ?? 1)}
            onChange={({ detail }) => cambiar({ pagina: detail.currentPageIndex })}
            disabled={consulta.isFetching}
          />
        }
        preferences={
          <CollectionPreferences
            title="Preferencias"
            confirmLabel="Confirmar"
            cancelLabel="Cancelar"
            preferences={{ pageSize: tamano }}
            pageSizePreference={{ title: "Eventos por página", options: TAMANOS.map((n) => ({ value: n, label: `${n} eventos` })) }}
            onConfirm={({ detail }) => cambiar({ tamano: detail.pageSize ?? TAMANOS[0] })}
          />
        }
      />

      <PanelDividido
        abierto={!!seleccionado}
        titulo={seleccionado ? etiquetaAccion(seleccionado.accion) : ""}
        descripcion={seleccionado ? fechaCompleta(seleccionado.ocurridoEn) : undefined}
        onCerrar={() => cambiar({ evento: null }, { conservarPagina: true })}
      >
        {seleccionado && <DetalleEvento evento={seleccionado} onVerActor={verActor} onVerEntidad={verEntidad} onVerPeticion={verPeticion} />}
      </PanelDividido>

      {confirmarExportar && (
        <ModalConfirmacion titulo="Exportación limitada" boton="Exportar igualmente" procesando={exportando} onConfirmar={() => void exportar()} onCancelar={() => setConfirmarExportar(false)}>
          {`Hay ${numero(total)} eventos y se exportarán los primeros ${numero(LIMITE_EXPORTACION)}. Acota el periodo si necesitas el resto.`}
        </ModalConfirmacion>
      )}
    </>
  );
}
