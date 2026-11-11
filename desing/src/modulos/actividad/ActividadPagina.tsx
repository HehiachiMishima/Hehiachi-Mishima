import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ContentLayout from "@cloudscape-design/components/content-layout";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import TokenGroup from "@cloudscape-design/components/token-group";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { MetodoHttp } from "@/compartido/componentes/Insignias";
import { ModalConfirmacion } from "@/compartido/componentes/ModalConfirmacion";
import { useDirectorioUsuarios } from "@/compartido/datos/directorio";
import { PanelDividido } from "@/compartido/marco/PanelDividido";
import { useParametrosUrl } from "@/compartido/navegacion";
import { diaHora, fechaCompleta, login, numero, zonaHoraria, zonaIana } from "@/compartido/util/formato";
import { mensajeDeError } from "@/core/api/errores";
import { useNotificaciones } from "@/core/notificaciones/contexto";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { DetallePeticion } from "./componentes/DetallePeticion";
import { EstadoHttp } from "./componentes/EstadoHttp";
import { FiltrosActividad } from "./componentes/FiltrosActividad";
import { ResumenUsuario } from "./componentes/ResumenUsuario";
import { useActividadUsuario, useCerrarSesiones, usePeticiones } from "./consultas";
import { aConsulta, CLAVES_URL, diasDe, hayFiltros, LENTA_MS, leerFiltros } from "./filtros";
import type { PeticionTraza } from "./tipos";
import { InfoAyuda } from "@/compartido/marco/InfoAyuda";

const TAMANOS = [25, 50, 100];
const ZONA = zonaIana();

/** Traza de cada petición a la API: quién, qué, desde dónde, con qué resultado y cuánto tardó. */
export default function ActividadPagina() {
  const [params, cambiar] = useParametrosUrl();
  const navegar = useNavigate();
  const { puede } = useSesion();
  const { notificar } = useNotificaciones();
  const directorio = useDirectorioUsuarios();
  const [ancla, setAncla] = useState(() => Date.now());
  const [seleccion, setSeleccion] = useState<PeticionTraza | null>(null);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const cerrar = useCerrarSesiones();

  const filtros = useMemo(() => leerFiltros(params), [params]);
  const pagina = Math.max(1, Number(params.get("pagina")) || 1);
  const tamano = TAMANOS.includes(Number(params.get("tamano"))) ? Number(params.get("tamano")) : TAMANOS[0];
  const consulta = usePeticiones(aConsulta(filtros, ancla, pagina, tamano));
  const actividad = useActividadUsuario(filtros.actorId, diasDe(filtros), ZONA);
  const peticiones = consulta.data?.contenido ?? [];

  const usuario = filtros.actorId ? directorio.porId.get(filtros.actorId) : undefined;
  const nombreUsuario = usuario ? login(usuario.usuario) : filtros.actorId ? `Usuario #${filtros.actorId}` : "";

  const actualizar = () => {
    setAncla(Date.now());
    void consulta.refetch();
    if (filtros.actorId) void actividad.refetch();
  };
  const limpiar = () => cambiar(Object.fromEntries(CLAVES_URL.map((c) => [c, null])));

  const cerrarSesiones = (motivo: string | undefined) =>
    cerrar.mutate(
      { id: filtros.actorId!, motivo },
      {
        onSuccess: () => {
          setConfirmarCierre(false);
          notificar({
            type: "success",
            content: `Se cerraron las sesiones de ${nombreUsuario}. Deberá iniciar sesión de nuevo.`,
          });
        },
        onError: (e) =>
          notificar({
            type: "error",
            header: "No se pudieron cerrar las sesiones",
            content: mensajeDeError(e),
          }),
      },
    );

  const fichas = filtros.ruta
    ? [
        {
          label: `Endpoint ${filtros.ruta}`,
          dismissLabel: "Quitar filtro de endpoint",
        },
      ]
    : [];

  return (
    <>
      <ContentLayout
        header={
          filtros.actorId ? (
            <Header variant="h1" info={<InfoAyuda />} description={`Qué hizo ${nombreUsuario}, cuándo y con qué resultado. Horas en ${zonaHoraria()}.`}>
              {`Actividad de ${nombreUsuario}`}
            </Header>
          ) : undefined
        }
      >
        <SpaceBetween size="l">
          {filtros.actorId && (
            <ResumenUsuario
              nombre={nombreUsuario}
              actividad={actividad.data}
              cargando={actividad.isFetching}
              onAuditoria={puede(PERMISOS.VER_AUDITORIA) ? () => navegar(`/auditoria?actorId=${filtros.actorId}&rango=30d`) : undefined}
              onCerrarSesiones={puede(PERMISOS.MODIFICAR_USUARIOS) ? () => setConfirmarCierre(true) : undefined}
            />
          )}
          <Table
            variant={filtros.actorId ? "container" : "full-page"}
            stickyHeader
            resizableColumns
            items={peticiones}
            trackBy={(p) => String(p.id ?? `${p.ocurridoEn}-${p.uri}`)}
            loading={consulta.isPending}
            loadingText="Cargando peticiones"
            selectionType="single"
            selectedItems={seleccion ? [seleccion] : []}
            onSelectionChange={({ detail }) => setSeleccion(detail.selectedItems[0] ?? null)}
            ariaLabels={{
              tableLabel: "Peticiones a la API",
              selectionGroupLabel: "Petición seleccionada",
              itemSelectionLabel: (_, p) => `Ver ${p.metodo} ${p.uri}`,
            }}
            header={
              <Header
                variant={filtros.actorId ? "h2" : "awsui-h1-sticky"}
                info={<InfoAyuda />}
                counter={consulta.data ? `(${numero(consulta.data.total)})` : undefined}
                description={filtros.actorId ? undefined : `Cada llamada a la API con su usuario, resultado y duración. Horas en ${zonaHoraria()}.`}
                actions={<Button iconName="refresh" ariaLabel="Actualizar" loading={consulta.isFetching} onClick={actualizar} />}
              >
                {filtros.actorId ? "Peticiones" : "Actividad"}
              </Header>
            }
            filter={
              <SpaceBetween size="s">
                <FiltrosActividad
                  key={`${params.get("actorId") ?? ""}-${directorio.lista.length > 0}`}
                  filtros={filtros}
                  usuarios={directorio.lista}
                  onCambio={(c) => cambiar(c)}
                />
                {(fichas.length > 0 || hayFiltros(params)) && (
                  <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                    {fichas.length > 0 && <TokenGroup items={fichas} onDismiss={() => cambiar({ ruta: null })} />}
                    <Button variant="inline-link" onClick={limpiar}>
                      Limpiar filtros
                    </Button>
                  </SpaceBetween>
                )}
              </SpaceBetween>
            }
            columnDefinitions={[
              {
                id: "fecha",
                header: "Fecha",
                cell: (p) => <span title={fechaCompleta(p.ocurridoEn)}>{diaHora(p.ocurridoEn)}</span>,
                width: 170,
              },
              {
                id: "estado",
                header: "Resultado",
                cell: (p) => <EstadoHttp estado={p.estado} />,
                width: 190,
              },
              {
                id: "operacion",
                header: "Operación",
                isRowHeader: true,
                minWidth: 260,
                cell: (p) => (
                <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                  <MetodoHttp metodo={p.metodo} />
                  <Link href="#" onFollow={(e) => (e.preventDefault(), setSeleccion(p))}>
                    {p.uri}
                  </Link>
                </SpaceBetween>
              ),
              },
              {
                id: "usuario",
                header: "Usuario",
                cell: (p) =>
                  p.actorId ? (
                    <Link variant="secondary" href={`?actorId=${p.actorId}`} onFollow={(e) => (e.preventDefault(), cambiar({ actorId: p.actorId }))}>
                      {login(p.actorUsuario ?? `#${p.actorId}`)}
                    </Link>
                  ) : (
                    <Box color="text-body-secondary">Anónimo</Box>
                  ),
              },
              {
                id: "duracion",
                header: "Duración",
                cell: (p) =>
                  p.duracionMs >= LENTA_MS ? <StatusIndicator type="warning">{`${numero(p.duracionMs)} ms`}</StatusIndicator> : `${numero(p.duracionMs)} ms`,
              },
              { id: "ip", header: "IP", cell: (p) => p.ip ?? "—" },
            ]}
            empty={
              consulta.isError ? (
                <EstadoVacio
                  titulo="No se pudo cargar la actividad"
                  texto={mensajeDeError(consulta.error)}
                  accion={<Button onClick={actualizar}>Reintentar</Button>}
                />
              ) : hayFiltros(params) ? (
                <EstadoVacio
                  titulo="No hay peticiones con estos filtros"
                  texto="Amplía el periodo o quita algún filtro."
                  accion={
                    <SpaceBetween direction="horizontal" size="xs">
                      <Button onClick={() => cambiar({ rango: "30d", desde: null, hasta: null })}>Ampliar a 30 días</Button>
                      <Button onClick={limpiar}>Limpiar filtros</Button>
                    </SpaceBetween>
                  }
                />
              ) : (
                <EstadoVacio titulo="Aún no hay peticiones" texto="Cada llamada a la API aparecerá aquí con su usuario, resultado y duración." />
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
                pageSizePreference={{
                  title: "Peticiones por página",
                  options: TAMANOS.map((n) => ({
                    value: n,
                    label: `${n} peticiones`,
                  })),
                }}
                onConfirm={({ detail }) => cambiar({ tamano: detail.pageSize ?? TAMANOS[0] })}
              />
            }
          />
        </SpaceBetween>
      </ContentLayout>

      <PanelDividido
        abierto={!!seleccion}
        titulo={seleccion ? `${seleccion.metodo} ${seleccion.ruta}` : ""}
        descripcion={seleccion ? fechaCompleta(seleccion.ocurridoEn) : undefined}
        onCerrar={() => setSeleccion(null)}
      >
        {seleccion && (
          <DetallePeticion
            peticion={seleccion}
            onFiltrarEndpoint={(ruta) => {
              setSeleccion(null);
              cambiar({ ruta });
            }}
            onVerAuditoria={puede(PERMISOS.VER_AUDITORIA) ? (id) => navegar(`/auditoria?q=${encodeURIComponent(id)}&rango=30d`) : undefined}
          />
        )}
      </PanelDividido>

      {confirmarCierre && (
        <ModalConfirmacion
          titulo={`¿Cerrar las sesiones de ${nombreUsuario}?`}
          boton="Cerrar sesiones"
          conMotivo
          procesando={cerrar.isPending}
          onConfirmar={cerrarSesiones}
          onCancelar={() => setConfirmarCierre(false)}
        >
          Sus sesiones dejarán de funcionar al instante y tendrá que iniciar sesión de nuevo. Su cuenta, roles y permisos no cambian.
        </ModalConfirmacion>
      )}
    </>
  );
}
