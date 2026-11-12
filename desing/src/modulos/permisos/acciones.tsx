import { useState } from "react";
import { useNavigate } from "react-router";
import type { ButtonDropdownProps } from "@cloudscape-design/components/button-dropdown";
import { ModalCatalogo } from "@/compartido/componentes/ModalCatalogo";
import { ModalConfirmacion } from "@/compartido/componentes/ModalConfirmacion";
import { plural } from "@/compartido/util/formato";
import { mensajeDeError } from "@/core/api/errores";
import { useNotificaciones } from "@/core/notificaciones/contexto";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { useCambiarEstadoPermiso, useEliminarPermiso, useGuardarPermiso, useRolesPermiso } from "./consultas";
import type { AccionPermiso, Permiso } from "./tipos";

export const MOTIVO_PROTEGIDO = "Permiso base del sistema: no se puede modificar ni eliminar.";

type Pendiente = { accion: "crear" } | { accion: "editar" | "desactivar" | "eliminar"; permiso: Permiso };

/** Acciones sobre permisos (lista y detalle). */
export function useAccionesPermiso({ enDetalle = false, alEliminar }: { enDetalle?: boolean; alEliminar?: () => void } = {}) {
  const { puede } = useSesion();
  const navegar = useNavigate();
  const { notificar } = useNotificaciones();
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const guardar = useGuardarPermiso();
  const estado = useCambiarEstadoPermiso();
  const eliminar = useEliminarPermiso();
  const rolesImpacto = useRolesPermiso(pendiente?.accion === "desactivar" ? pendiente.permiso.id : null);

  function items(p: Permiso): ButtonDropdownProps.ItemOrGroup[] {
    const bloqueo = p.protegido ? MOTIVO_PROTEGIDO : undefined;
    const con = (id: AccionPermiso, text: string): ButtonDropdownProps.Item => ({ id, text, disabled: !!bloqueo, disabledReason: bloqueo });
    const lista: ButtonDropdownProps.ItemOrGroup[] = [];
    if (!enDetalle) lista.push({ id: "detalle", text: "Ver detalle" });
    if (puede(PERMISOS.MODIFICAR_PERMISOS)) {
      if (!enDetalle) lista.push(con("editar", "Editar"));
      lista.push(p.activo ? con("desactivar", "Desactivar") : con("activar", "Activar"));
    }
    if (puede(PERMISOS.ELIMINAR_PERMISOS)) lista.push(con("eliminar", "Eliminar"));
    return lista;
  }

  const abrirModal = (p: NonNullable<typeof pendiente>) => {
    setErrorModal(null);
    setPendiente(p);
  };
  const falloModal = (e: unknown) => setErrorModal(mensajeDeError(e));
  const fallo = (titulo: string) => (e: unknown) => notificar({ type: "error", header: titulo, content: mensajeDeError(e) });
  const listo = (mensaje: string) => () => {
    setPendiente(null);
    notificar({ type: "success", content: mensaje });
  };
  const nombre = (p: Permiso) => p.descripcion || p.nombre;

  function ejecutar(id: string, p: Permiso) {
    if (id === "detalle") navegar(`/permisos/${p.id}`);
    else if (id === "activar")
      estado.mutate({ id: p.id, activo: true }, { onSuccess: listo(`El permiso ${p.nombre} quedó activo.`), onError: fallo("No se pudo activar") });
    else abrirModal({ accion: id as "editar" | "desactivar" | "eliminar", permiso: p });
  }

  let modales: React.ReactNode = null;
  const cancelar = () => setPendiente(null);
  if (pendiente?.accion === "crear" || pendiente?.accion === "editar") {
    const actual = pendiente.accion === "editar" ? pendiente.permiso : null;
    modales = (
      <ModalCatalogo
        key={actual?.id ?? "nuevo"}
        entidad="permiso"
        ejemploNombre="EXPORTAR_REPORTES"
        inicial={actual}
        onCancelar={cancelar}
        onGuardar={async (datos) => {
          const p = await guardar.mutateAsync({ id: actual?.id, datos });
          listo(actual ? `Se guardaron los cambios del permiso ${p.nombre}.` : `Se creó el permiso ${p.nombre}.`)();
          if (!actual) navegar(`/permisos/${p.id}`);
        }}
      />
    );
  } else if (pendiente?.accion === "desactivar") {
    const p = pendiente.permiso;
    const n = rolesImpacto.data?.length;
    modales = (
      <ModalConfirmacion
        error={errorModal}
        key={`desactivar-${p.id}`}
        titulo={`¿Desactivar ${nombre(p)}?`}
        boton="Desactivar"
        conMotivo
        procesando={estado.isPending}
        onCancelar={cancelar}
        onConfirmar={(motivo) => estado.mutate({ id: p.id, activo: false, motivo }, { onSuccess: listo(`El permiso ${p.nombre} quedó inactivo.`), onError: falloModal })}
      >
        {`Dejará de conceder acceso${n === undefined ? "" : n === 0 ? " (ningún rol lo concede ahora)" : ` a los usuarios de ${plural(n, "rol", "roles")}`}. Las asignaciones se conservan y podrás reactivarlo.`}
      </ModalConfirmacion>
    );
  } else if (pendiente?.accion === "eliminar") {
    const p = pendiente.permiso;
    modales = (
      <ModalConfirmacion
        error={errorModal}
        key={`eliminar-${p.id}`}
        titulo={`¿Eliminar ${nombre(p)}?`}
        boton="Eliminar"
        procesando={eliminar.isPending}
        onCancelar={cancelar}
        onConfirmar={() =>
          eliminar.mutate(p.id, {
            onSuccess: () => {
              listo(`Se eliminó el permiso ${p.nombre}.`)();
              alEliminar?.();
            },
            onError: falloModal,
          })
        }
      >
        Se quitará de todos los roles y ajustes individuales. Esta acción no se puede deshacer.
      </ModalConfirmacion>
    );
  }

  return { items, ejecutar, crear: () => abrirModal({ accion: "crear" }), modales };
}
