import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import Tabs, { type TabsProps } from "@cloudscape-design/components/tabs";
import { Historial } from "@/compartido/auditoria/Historial";
import { CargandoPagina } from "@/compartido/componentes/CargandoPagina";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { useDirectorioUsuarios } from "@/compartido/datos/directorio";
import { useMarcoPagina } from "@/compartido/marco/useMarcoPagina";
import { useSeguirEnlace } from "@/compartido/navegacion";
import { fechaHora, haceCuanto, login } from "@/compartido/util/formato";
import { ErrorApi, mensajeDeError } from "@/core/api/errores";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { MOTIVO_PROTEGIDO, useAccionesPermiso } from "../acciones";
import { usePermiso, useRolesPermiso } from "../consultas";
import { InfoAyuda } from "@/compartido/marco/InfoAyuda";

/** Detalle de un permiso: datos, roles que lo conceden e historial. */
export function DetallePermiso() {
  const id = Number(useParams().id);
  const navegar = useNavigate();
  const seguir = useSeguirEnlace();
  const { puede } = useSesion();
  const directorio = useDirectorioUsuarios();
  const [pestana, setPestana] = useState("roles");
  const consulta = usePermiso(id);
  const roles = useRolesPermiso(id);
  const acciones = useAccionesPermiso({ enDetalle: true, alEliminar: () => navegar("/permisos") });
  const p = consulta.data;

  useMarcoPagina({ migas: [{ text: p?.nombre ?? `#${id}`, href: `/permisos/${id}` }] });

  if (consulta.isPending) return <CargandoPagina />;
  if (!p) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.status === 404;
    return (
      <Container>
        <EstadoVacio titulo={noExiste ? "Permiso no encontrado" : "No se pudo cargar el permiso"} texto={noExiste ? "Puede que se haya eliminado." : mensajeDeError(consulta.error)} accion={<Button onClick={() => navegar("/permisos")}>Volver a permisos</Button>} />
      </Container>
    );
  }

  const por = (i: number | null) => (i === null ? "—" : i === 0 ? "Sistema" : login(directorio.porId.get(i)?.usuario ?? `#${i}`));
  const tabs: TabsProps.Tab[] = [];
  if (puede(PERMISOS.VER_ROLES)) {
    tabs.push({
      id: "roles",
      label: `Roles que lo conceden (${roles.data?.length ?? 0})`,
      content: (
        <Table
          variant="borderless"
          items={roles.data ?? []}
          trackBy="id"
          loading={roles.isPending}
          loadingText="Cargando roles"
          ariaLabels={{ tableLabel: "Roles con este permiso" }}
          empty={<EstadoVacio titulo="Sin roles" texto="Ningún rol concede este permiso todavía. Se agrega desde el detalle de un rol." />}
          columnDefinitions={[
            {
              id: "rol",
              header: "Rol",
              isRowHeader: true,
              cell: (r) => (
                <Link href={`/roles/${r.id}`} onFollow={seguir}>
                  {r.nombre}
                </Link>
              ),
            },
            { id: "descripcion", header: "Descripción", cell: (r) => r.descripcion || "—" },
            { id: "estado", header: "Estado", cell: (r) => <StatusIndicator type={r.activo ? "success" : "stopped"}>{r.activo ? "Activo" : "Inactivo"}</StatusIndicator> },
          ]}
        />
      ),
    });
  }
  if (puede(PERMISOS.VER_AUDITORIA)) tabs.push({ id: "historial", label: "Historial", content: <Historial relacionadoCon={`PERMISO:${id}`} /> });

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          info={<InfoAyuda />}
          description={<Box variant="code">{p.nombre}</Box>}
          actions={
            <ButtonDropdown items={acciones.items(p)} onItemClick={({ detail }) => acciones.ejecutar(detail.id, p)}>
              Acciones
            </ButtonDropdown>
          }
        >
          {p.descripcion || p.nombre}
        </Header>
      }
    >
      <SpaceBetween size="l">
        {p.protegido && <Alert type="info">{MOTIVO_PROTEGIDO}</Alert>}
        <Container header={<Header variant="h2">Detalles</Header>}>
          <KeyValuePairs
            columns={4}
            items={[
              { label: "Código", value: p.nombre },
              {
                label: "Estado",
                value: (
                  <SpaceBetween direction="horizontal" size="xs">
                    <StatusIndicator type={p.activo ? "success" : "stopped"}>{p.activo ? "Activo" : "Inactivo"}</StatusIndicator>
                  </SpaceBetween>
                ),
              },
              { label: "Creado", value: `${fechaHora(p.creadoEn)} por ${por(p.creadoPor)}` },
              { label: "Último cambio", value: p.actualizadoEn ? `${haceCuanto(p.actualizadoEn)} por ${por(p.actualizadoPor)}` : "Sin cambios" },
            ]}
          />
        </Container>
        {tabs.length > 0 && <Tabs variant="container" tabs={tabs} activeTabId={tabs.some((t) => t.id === pestana) ? pestana : tabs[0].id} onChange={({ detail }) => setPestana(detail.activeTabId)} ariaLabel="Secciones del permiso" />}
      </SpaceBetween>
      {acciones.modales}
    </ContentLayout>
  );
}
