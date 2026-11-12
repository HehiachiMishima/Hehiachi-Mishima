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
import { useCambiarEstadoRol, useEliminarRol, useGuardarRol, usePermisosRol, useUsuariosRol } from "./consultas";
import type { AccionRol, Rol } from "./tipos";

export const MOTIVO_PROTEGIDO = "Rol protegido del sistema: no se puede modificar ni eliminar; solo se le pueden agregar permisos.";

type Pendiente = { accion: "crear" } | { accion: Exclude<AccionRol, "detalle" | "activar">; rol: Rol };

/** Acciones sobre roles (lista y detalle): alta/edición en modal, activar/desactivar con impacto y eliminar. */
export function useAccionesRol({ enDetalle = false, alEliminar }: { enDetalle?: boolean; alEliminar?: () => void } = {}) {
  const { puede } = useSesion();
  const navegar = useNavigate();
  const { notificar } = useNotificaciones();
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const guardar = useGuardarRol();
  const estado = useCambiarEstadoRol();
  const eliminar = useEliminarRol();
  const idImpacto = pendiente?.accion === "desactivar" ? pendiente.rol.id : null;
  const permisosImpacto = usePermisosRol(idImpacto);
  const usuariosImpacto = useUsuariosRol(idImpacto);

  function items(r: Rol): ButtonDropdownProps.ItemOrGroup[] {
    const bloqueo = r.protegido ? MOTIVO_PROTEGIDO : undefined;
    const con = (id: AccionRol, text: string): ButtonDropdownProps.Item => ({ id, text, disabled: !!bloqueo, disabledReason: bloqueo });
    const lista: ButtonDropdownProps.ItemOrGroup[] = [];
    if (!enDetalle) lista.push({ id: "detalle", text: "Ver detalle" });
    if (puede(PERMISOS.MODIFICAR_ROLES)) {
      // En el detalle "Editar" es el botón principal (igual que en Usuarios).
      if (!enDetalle) lista.push(con("editar", "Editar"));
      lista.push(r.activo ? con("desactivar", "Desactivar") : con("activar", "Activar"));
    }
    if (puede(PERMISOS.ELIMINAR_ROLES)) lista.push(con("eliminar", "Eliminar"));
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

  function ejecutar(id: string, r: Rol) {
    if (id === "detalle") navegar(`/roles/${r.id}`);
    else if (id === "activar")
      estado.mutate({ id: r.id, activo: true }, { onSuccess: listo(`El rol ${r.nombre} quedó activo.`), onError: fallo("No se pudo activar") });
    else abrirModal({ accion: id as "editar" | "desactivar" | "eliminar", rol: r });
  }

  const crear = () => abrirModal({ accion: "crear" });

  let modales: React.ReactNode = null;
  const cancelar = () => setPendiente(null);
  if (pendiente?.accion === "crear" || pendiente?.accion === "editar") {
    const rol = pendiente.accion === "editar" ? pendiente.rol : null;
    modales = (
      <ModalCatalogo
        key={rol?.id ?? "nuevo"}
        entidad="rol"
        ejemploNombre="AUDITOR"
        inicial={rol}
        onCancelar={cancelar}
        onGuardar={async (datos) => {
          const r = await guardar.mutateAsync({ id: rol?.id, datos });
          listo(rol ? `Se guardaron los cambios del rol ${r.nombre}.` : `Se creó el rol ${r.nombre}.`)();
          if (!rol) navegar(`/roles/${r.id}`);
        }}
      />
    );
  } else if (pendiente?.accion === "desactivar") {
    const r = pendiente.rol;
    const n = usuariosImpacto.data?.length;
    const p = permisosImpacto.data?.length;
    const sinCifras = (permisosImpacto.fetchStatus === "idle" && !permisosImpacto.data) || (usuariosImpacto.fetchStatus === "idle" && !usuariosImpacto.data);
    const impacto = sinCifras
      ? "Sus usuarios dejarán de recibir los permisos de este rol. Las asignaciones se conservan y podrás reactivarlo."
      : n === undefined || p === undefined
        ? "Calculando a cuántos usuarios afecta…"
        : `${n === 0 ? "Ningún usuario tiene este rol" : `${plural(n, "usuario dejará", "usuarios dejarán")} de recibir ${p === 1 ? "su único permiso" : `sus ${p} permisos`}`}. Las asignaciones se conservan y podrás reactivarlo.`;
    modales = (
      <ModalConfirmacion
        error={errorModal}
        key={`desactivar-${r.id}`}
        titulo={`¿Desactivar el rol ${r.nombre}?`}
        boton="Desactivar"
        conMotivo
        procesando={estado.isPending}
        onCancelar={cancelar}
        onConfirmar={(motivo) =>
          estado.mutate({ id: r.id, activo: false, motivo }, { onSuccess: listo(`El rol ${r.nombre} quedó inactivo.`), onError: falloModal })
        }
      >
        {impacto}
      </ModalConfirmacion>
    );
  } else if (pendiente?.accion === "eliminar") {
    const r = pendiente.rol;
    modales = (
      <ModalConfirmacion
        error={errorModal}
        key={`eliminar-${r.id}`}
        titulo={`¿Eliminar el rol ${r.nombre}?`}
        boton="Eliminar"
        procesando={eliminar.isPending}
        onCancelar={cancelar}
        onConfirmar={() =>
          eliminar.mutate(r.id, {
            onSuccess: () => {
              listo(`Se eliminó el rol ${r.nombre}.`)();
              alEliminar?.();
            },
            onError: falloModal,
          })
        }
      >
        Sus usuarios perderán los permisos que reciben de este rol. Esta acción no se puede deshacer; si solo quieres dejar de usarlo, desactívalo.
      </ModalConfirmacion>
    );
  }

  return { items, ejecutar, crear, modales };
}
