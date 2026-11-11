import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
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
import { useNotificaciones } from "@/core/notificaciones/contexto";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { MOTIVO_PROTEGIDO, useAccionesRol } from "../acciones";
import { TablaPermisosRol } from "../componentes/TablaPermisosRol";
import { useAlternarPermisoRol, useCatalogoPermisos, usePermisosRol, useRol, useUsuariosRol } from "../consultas";

/** Detalle de un rol: datos, permisos que concede (editables), usuarios que lo tienen e historial. */
export function DetalleRol() {
  const id = Number(useParams().id);
  const navegar = useNavigate();
  const seguir = useSeguirEnlace();
  const { puede } = useSesion();
  const { notificar } = useNotificaciones();
  const directorio = useDirectorioUsuarios();
  const [pestana, setPestana] = useState("permisos");
  const consulta = useRol(id);
  const permisos = usePermisosRol(id);
  const usuarios = useUsuariosRol(id);
  const catalogo = useCatalogoPermisos();
  const alternar = useAlternarPermisoRol();
  const acciones = useAccionesRol({ enDetalle: true, alEliminar: () => navegar("/roles") });
  const r = consulta.data;

  useMarcoPagina({ migas: [{ text: r?.nombre ?? `#${id}`, href: `/roles/${id}` }] });

  if (consulta.isPending) return <CargandoPagina />;
  if (!r) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.status === 404;
    return (
      <Container>
        <EstadoVacio titulo={noExiste ? "Rol no encontrado" : "No se pudo cargar el rol"} texto={noExiste ? "Puede que se haya eliminado." : mensajeDeError(consulta.error)} accion={<Button onClick={() => navegar("/roles")}>Volver a roles</Button>} />
      </Container>
    );
  }

  const por = (i: number | null) => (i === null ? "—" : i === 0 ? "Sistema" : login(directorio.porId.get(i)?.usuario ?? `#${i}`));
  const asignados = new Set((permisos.data ?? []).map((p) => p.id));
  const listaUsuarios = usuarios.data ?? [];

  const tabs: TabsProps.Tab[] = [
    {
      id: "permisos",
      label: `Permisos (${asignados.size})`,
      content: (
        <TablaPermisosRol
          catalogo={catalogo.data ?? permisos.data ?? []}
          asignados={asignados}
          cargando={permisos.isPending}
          cambiando={alternar.isPending ? (alternar.variables?.permisoId ?? null) : null}
          puedeAsignar={puede(PERMISOS.ASIGNAR_PERMISOS)}
          protegido={!!r.protegido}
          usuarios={usuarios.data?.length}
          onAlternar={(p, asignar) =>
            alternar.mutate(
              { id, permisoId: p.id, asignar },
              {
                onSuccess: () => notificar({ type: "success", content: `${asignar ? "Permiso concedido" : "Permiso retirado"}: ${p.descripcion || p.nombre}.` }),
                onError: (e) => notificar({ type: "error", header: "No se pudo cambiar el permiso", content: mensajeDeError(e) }),
              },
            )
          }
        />
      ),
    },
    {
      id: "usuarios",
      label: `Usuarios (${listaUsuarios.length})`,
      content: (
        <Table
          variant="borderless"
          items={listaUsuarios}
          trackBy="id"
          loading={usuarios.isPending}
          loadingText="Cargando usuarios"
          ariaLabels={{ tableLabel: "Usuarios con este rol" }}
          empty={<EstadoVacio titulo="Sin usuarios" texto="Nadie tiene este rol todavía." />}
          columnDefinitions={[
            {
              id: "usuario",
              header: "Usuario",
              isRowHeader: true,
              cell: (u) =>
                puede(PERMISOS.VER_USUARIOS) ? (
                  <Link href={`/usuarios/${u.id}`} onFollow={seguir}>
                    {login(u.usuario)}
                  </Link>
                ) : (
                  login(u.usuario)
                ),
            },
            { id: "nombre", header: "Nombre", cell: (u) => `${u.nombre} ${u.apellido}` },
            { id: "email", header: "Correo", cell: (u) => u.email },
            { id: "estado", header: "Estado", cell: (u) => <StatusIndicator type={u.activo ? "success" : "stopped"}>{u.activo ? "Activo" : "Inactivo"}</StatusIndicator> },
          ]}
        />
      ),
    },
  ];
  if (puede(PERMISOS.VER_AUDITORIA)) tabs.push({ id: "historial", label: "Historial", content: <Historial relacionadoCon={`ROL:${id}`} /> });

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description={r.descripcion ?? "Sin descripción"}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <ButtonDropdown items={acciones.items(r)} onItemClick={({ detail }) => acciones.ejecutar(detail.id, r)}>
                Acciones
              </ButtonDropdown>
            </SpaceBetween>
          }
        >
          {r.nombre}
        </Header>
      }
    >
      <SpaceBetween size="l">
        {r.protegido && <Alert type="info">{MOTIVO_PROTEGIDO}</Alert>}
        <Container header={<Header variant="h2">Detalles</Header>}>
          <KeyValuePairs
            columns={4}
            items={[
              {
                label: "Estado",
                value: (
                  <SpaceBetween direction="horizontal" size="xs">
                    <StatusIndicator type={r.activo ? "success" : "stopped"}>{r.activo ? "Activo" : "Inactivo"}</StatusIndicator>
                    {r.protegido && <Badge>Protegido</Badge>}
                  </SpaceBetween>
                ),
              },
              { label: "Usuarios", value: usuarios.data ? String(listaUsuarios.length) : "—" },
              { label: "Creado", value: `${fechaHora(r.creadoEn)} por ${por(r.creadoPor)}` },
              { label: "Último cambio", value: r.actualizadoEn ? `${haceCuanto(r.actualizadoEn)} por ${por(r.actualizadoPor)}` : "Sin cambios" },
            ]}
          />
        </Container>
        <Tabs variant="container" tabs={tabs} activeTabId={pestana} onChange={({ detail }) => setPestana(detail.activeTabId)} ariaLabel="Secciones del rol" />
      </SpaceBetween>
      {acciones.modales}
    </ContentLayout>
  );
}
