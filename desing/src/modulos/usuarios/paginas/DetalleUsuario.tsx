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
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Tabs, { type TabsProps } from "@cloudscape-design/components/tabs";
import { Historial } from "@/compartido/auditoria/Historial";
import { CargandoPagina } from "@/compartido/componentes/CargandoPagina";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { useDirectorioUsuarios } from "@/compartido/datos/directorio";
import { useMarcoPagina } from "@/compartido/marco/useMarcoPagina";
import { fechaHora, haceCuanto, login } from "@/compartido/util/formato";
import { ErrorApi, mensajeDeError } from "@/core/api/errores";
import { useNotificaciones } from "@/core/notificaciones/contexto";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { MOTIVO_PROTEGIDO, useAccionesUsuario } from "../acciones";
import { TablaPermisosUsuario } from "../componentes/TablaPermisosUsuario";
import { TablaRolesUsuario } from "../componentes/TablaRolesUsuario";
import { useAlternarRol, useAplicarAjuste, useCatalogoRoles, usePermisosUsuario, useRolesUsuario, useUsuario } from "../consultas";

const AJUSTE_TEXTO = { heredar: "Ajuste eliminado: hereda de sus roles", conceder: "Permiso concedido", denegar: "Permiso denegado" } as const;

/** Detalle de una cuenta: datos, roles, permisos efectivos (con su porqué) e historial. */
export function DetalleUsuario() {
  const id = Number(useParams().id);
  const navegar = useNavigate();
  const { puede } = useSesion();
  const { notificar } = useNotificaciones();
  const directorio = useDirectorioUsuarios();
  const [pestana, setPestana] = useState("roles");

  const consulta = useUsuario(id);
  const u = consulta.data;
  const acciones = useAccionesUsuario({ enDetalle: true, alEliminar: () => navegar("/usuarios") });
  const verRoles = puede(PERMISOS.ASIGNAR_ROLES) || puede(PERMISOS.VER_ROLES);
  const verPermisos = puede(PERMISOS.VER_PERMISOS);
  const catalogoRoles = useCatalogoRoles();
  const rolesUsuario = useRolesUsuario(id);
  const permisos = usePermisosUsuario(id);
  const alternarRol = useAlternarRol();
  const aplicarAjuste = useAplicarAjuste();

  useMarcoPagina({ migas: [{ text: u ? login(u.usuario) : `#${id}`, href: `/usuarios/${id}` }] });

  if (consulta.isPending) return <CargandoPagina />;
  if (!u) {
    const noExiste = consulta.error instanceof ErrorApi && consulta.error.status === 404;
    return (
      <Container>
        <EstadoVacio
          titulo={noExiste ? "Usuario no encontrado" : "No se pudo cargar el usuario"}
          texto={noExiste ? "Puede que se haya eliminado." : mensajeDeError(consulta.error)}
          accion={<Button onClick={() => navegar("/usuarios")}>Volver a usuarios</Button>}
        />
      </Container>
    );
  }

  const bloqueo = u.protegido ? MOTIVO_PROTEGIDO : undefined;
  const nombrePor = (id: number | null) => (id === null ? "—" : id === 0 ? "Sistema" : login(directorio.porId.get(id)?.usuario ?? `#${id}`));
  const asignados = new Set((rolesUsuario.data ?? []).map((r) => r.id));
  const fallo = (titulo: string) => (e: unknown) => notificar({ type: "error", header: titulo, content: mensajeDeError(e) });

  const tabs: TabsProps.Tab[] = [];
  if (verRoles) {
    tabs.push({
      id: "roles",
      label: `Roles (${asignados.size})`,
      content: (
        <TablaRolesUsuario
          catalogo={catalogoRoles.data ?? rolesUsuario.data ?? []}
          asignados={asignados}
          cargando={rolesUsuario.isPending || (catalogoRoles.isPending && catalogoRoles.fetchStatus !== "idle")}
          cambiando={alternarRol.isPending ? (alternarRol.variables?.rolId ?? null) : null}
          bloqueo={bloqueo}
          puedeAsignar={puede(PERMISOS.ASIGNAR_ROLES)}
          onAlternar={(rol, asignar) =>
            alternarRol.mutate(
              { id, rolId: rol.id, asignar },
              { onSuccess: () => notificar({ type: "success", content: `${asignar ? "Rol asignado" : "Rol quitado"}: ${rol.nombre}.` }), onError: fallo("No se pudo cambiar el rol") },
            )
          }
        />
      ),
    });
  }
  if (verPermisos) {
    tabs.push({
      id: "permisos",
      label: "Permisos",
      content: permisos.isError ? (
        <Alert type="error" action={<Button onClick={() => void permisos.refetch()}>Reintentar</Button>}>
          {mensajeDeError(permisos.error, "No se pudieron resolver los permisos.")}
        </Alert>
      ) : (
        <TablaPermisosUsuario
          filas={permisos.data ?? []}
          cargando={permisos.isPending}
          cambiando={aplicarAjuste.isPending ? (aplicarAjuste.variables?.permisoId ?? null) : null}
          bloqueo={bloqueo}
          puedeEditar={puede(PERMISOS.ASIGNAR_PERMISOS)}
          onAjuste={(f, ajuste) =>
            aplicarAjuste.mutate(
              { id, permisoId: f.permiso.id, ajuste },
              { onSuccess: () => notificar({ type: "success", header: AJUSTE_TEXTO[ajuste], content: f.permiso.descripcion || f.permiso.nombre }), onError: fallo("No se pudo actualizar el permiso") },
            )
          }
        />
      ),
    });
  }
  if (puede(PERMISOS.VER_AUDITORIA)) {
    tabs.push({ id: "historial", label: "Historial", content: <Historial relacionadoCon={`USUARIO:${id}`} actorId={id} /> });
  }

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description={`${login(u.usuario)} · ${u.email}`}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <ButtonDropdown items={acciones.items(u)} onItemClick={({ detail }) => acciones.ejecutar(detail.id, u)}>
                Acciones
              </ButtonDropdown>
              {puede(PERMISOS.MODIFICAR_USUARIOS) && (
                <Button variant="primary" disabled={!!bloqueo} disabledReason={bloqueo} onClick={() => navegar(`/usuarios/${id}/editar`)}>
                  Editar
                </Button>
              )}
            </SpaceBetween>
          }
        >
          {`${u.nombre} ${u.apellido}`}
        </Header>
      }
    >
      <SpaceBetween size="l">
        {bloqueo && <Alert type="info">{bloqueo}</Alert>}
        <Container header={<Header variant="h2">Detalles</Header>}>
          <KeyValuePairs
            columns={3}
            items={[
              { label: "Usuario", value: login(u.usuario) },
              { label: "Correo electrónico", value: u.email },
              { label: "Teléfono", value: u.telefono || "Sin teléfono" },
              {
                label: "Estado",
                value: (
                  <SpaceBetween direction="horizontal" size="xs">
                    <StatusIndicator type={u.activo ? "success" : "stopped"}>{u.activo ? "Activo" : "Inactivo"}</StatusIndicator>
                    {u.protegido && <Badge>Protegido</Badge>}
                  </SpaceBetween>
                ),
              },
              { label: "Creado", value: `${fechaHora(u.creadoEn)} por ${nombrePor(u.creadoPor)}` },
              { label: "Último cambio", value: u.actualizadoEn ? `${haceCuanto(u.actualizadoEn)} por ${nombrePor(u.actualizadoPor)}` : "Sin cambios" },
            ]}
          />
        </Container>
        {tabs.length > 0 && <Tabs variant="container" tabs={tabs} activeTabId={tabs.some((t) => t.id === pestana) ? pestana : tabs[0].id} onChange={({ detail }) => setPestana(detail.activeTabId)} ariaLabel="Secciones del usuario" />}
      </SpaceBetween>
      {acciones.modales}
    </ContentLayout>
  );
}
