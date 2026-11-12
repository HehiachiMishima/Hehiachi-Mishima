import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useCollection } from "@cloudscape-design/collection-hooks";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import PropertyFilter, { type PropertyFilterProps } from "@cloudscape-design/components/property-filter";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { useSeguirEnlace } from "@/compartido/navegacion";
import { login } from "@/compartido/util/formato";
import { mensajeDeError } from "@/core/api/errores";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { useAccionesUsuario } from "../acciones";
import { aFila, columnas, PREFERENCIAS_INICIALES, PROPIEDADES_FILTRO } from "../columnas";
import { PreferenciasUsuarios } from "../componentes/PreferenciasUsuarios";
import { useResumenAccesos, useUsuarios } from "../consultas";
import { InfoAyuda } from "@/compartido/marco/InfoAyuda";

/** Filtro inicial desde la URL (enlaces del Resumen: ?estado=Activo, ?sinRol=1). */
function consultaInicial(p: URLSearchParams): PropertyFilterProps.Query {
  const tokens: PropertyFilterProps.Token[] = [];
  const estado = p.get("estado");
  if (estado === "Activo" || estado === "Inactivo") tokens.push({ propertyKey: "estado", operator: "=", value: estado });
  if (p.get("sinRol") === "1") tokens.push({ propertyKey: "sinRol", operator: "=", value: "Sí" });
  const rol = p.get("rol");
  if (rol) tokens.push({ propertyKey: "rolesTexto", operator: ":", value: rol });
  return { tokens, operation: "and" };
}

export function ListaUsuarios() {
  const { puede } = useSesion();
  const navegar = useNavigate();
  const seguir = useSeguirEnlace();
  const [params] = useSearchParams();
  const consulta = useUsuarios();
  const resumen = useResumenAccesos();
  const acciones = useAccionesUsuario();
  const [prefs, setPrefs] = useState(PREFERENCIAS_INICIALES);
  const [inicial] = useState(() => consultaInicial(params));

  const filas = useMemo(() => {
    const mapa = resumen.data ? new Map(resumen.data.map((r) => [r.usuarioId, r])) : null;
    return (consulta.data ?? []).map((u) => aFila(u, mapa));
  }, [consulta.data, resumen.data]);
  const errorCarga = consulta.isError ? mensajeDeError(consulta.error, "No se pudo cargar la lista.") : null;

  const { items, actions, filteredItemsCount, collectionProps, propertyFilterProps, paginationProps } = useCollection(filas, {
    propertyFiltering: {
      filteringProperties: PROPIEDADES_FILTRO,
      defaultQuery: inicial,
      empty: errorCarga ? (
        <EstadoVacio titulo="No se pudo cargar" texto={errorCarga} accion={<Button onClick={() => void consulta.refetch()}>Reintentar</Button>} />
      ) : (
        <EstadoVacio
          titulo="Sin usuarios"
          texto="Aún no hay usuarios registrados."
          accion={puede(PERMISOS.CREAR_USUARIOS) ? <Button onClick={() => navegar("/usuarios/nuevo")}>Crear usuario</Button> : undefined}
        />
      ),
      noMatch: (
        <EstadoVacio
          titulo="Sin coincidencias"
          texto="Ningún usuario cumple el filtro."
          // Patrón documentado de Cloudscape: `actions` se lee al hacer clic, cuando ya existe.
          // oxlint-disable-next-line react/immutability
          accion={<Button onClick={() => actions.setPropertyFiltering({ tokens: [], operation: "and" })}>Borrar filtro</Button>}
        />
      ),
    },
    sorting: { defaultState: { sortingColumn: { sortingField: "usuario" } } },
    pagination: { pageSize: prefs.pageSize },
    selection: { trackBy: "id" },
  });

  // La selección se resuelve contra los datos actuales: tras activar, editar o eliminar, el menú
  // "Acciones" refleja el estado nuevo y nunca apunta a un elemento que ya no existe.
  const idElegido = collectionProps.selectedItems?.[0]?.id;
  const elegido = filas.find((f) => f.id === idElegido);
  useEffect(() => {
    if (idElegido !== undefined && consulta.data && !elegido) actions.setSelectedItems([]);
    // oxlint-disable-next-line react/exhaustive-deps -- `actions` cambia en cada render
  }, [idElegido, elegido, consulta.data]);
  const cols = columnas((u) => (
    <Link href={`/usuarios/${u.id}`} onFollow={seguir}>
      {login(u.usuario)}
    </Link>
  ));

  return (
    <>
      <Table
        {...collectionProps}
        variant="full-page"
        stickyHeader
        resizableColumns
        enableKeyboardNavigation
        selectionType="single"
        trackBy="id"
        columnDefinitions={cols}
        columnDisplay={prefs.contentDisplay}
        items={items}
        loading={consulta.isPending}
        loadingText="Cargando usuarios"
        wrapLines={prefs.wrapLines}
        stripedRows={prefs.stripedRows}
        stickyColumns={prefs.stickyColumns}
        ariaLabels={{ selectionGroupLabel: "Selección de usuarios", itemSelectionLabel: (_, u) => `Seleccionar ${login(u.usuario)}`, tableLabel: "Usuarios" }}
        header={
          <Header
            variant="awsui-h1-sticky"
            info={<InfoAyuda />}
            counter={consulta.data ? `(${filas.length})` : undefined}
            description="Cuentas con acceso a la plataforma, sus roles y permisos efectivos"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" ariaLabel="Actualizar lista" loading={consulta.isFetching} onClick={() => void Promise.all([consulta.refetch(), resumen.refetch()])} />
                <ButtonDropdown
                  disabled={!elegido}
                  disabledReason="Selecciona un usuario."
                  items={elegido ? acciones.items(elegido) : []}
                  onItemClick={({ detail }) => elegido && acciones.ejecutar(detail.id, elegido)}
                >
                  Acciones
                </ButtonDropdown>
                {puede(PERMISOS.CREAR_USUARIOS) && (
                  <Button variant="primary" onClick={() => navegar("/usuarios/nuevo")}>
                    Crear usuario
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            Usuarios
          </Header>
        }
        filter={
          <PropertyFilter
            {...propertyFilterProps}
            countText={`${filteredItemsCount} ${filteredItemsCount === 1 ? "coincidencia" : "coincidencias"}`}
            filteringPlaceholder="Buscar usuarios por nombre, correo, estado o rol"
            filteringAriaLabel="Filtrar usuarios"
            expandToViewport
          />
        }
        pagination={<Pagination {...paginationProps} />}
        preferences={<PreferenciasUsuarios valor={prefs} onCambio={setPrefs} />}
      />
      {acciones.modales}
    </>
  );
}
