import { useState } from "react";
import { useNavigate } from "react-router";
import type { ButtonDropdownProps } from "@cloudscape-design/components/button-dropdown";
import { ModalConfirmacion } from "@/compartido/componentes/ModalConfirmacion";
import { login } from "@/compartido/util/formato";
import { ErrorApi, mensajeDeError } from "@/core/api/errores";
import { useNotificaciones } from "@/core/notificaciones/contexto";
import { PERMISOS } from "@/core/sesion/permisos";
import { useSesion } from "@/core/sesion/useSesion";
import { ModalRestablecer } from "./componentes/ModalRestablecer";
import { useCambiarEstadoUsuario, useCerrarSesionesUsuario, useEliminarUsuario, useRestablecerContrasena } from "./consultas";
import type { AccionUsuario, Usuario } from "./tipos";

export const MOTIVO_PROTEGIDO = "Cuenta protegida del sistema o tu propia cuenta: no se puede modificar.";

/**
 * Acciones sobre un usuario, iguales en la lista y en el detalle: qué se ofrece según permisos
 * y protección, la confirmación que pide cada una y su ejecución con aviso.
 *   const acc = useAccionesUsuario({ alEliminar: () => navegar("/usuarios") });
 *   <ButtonDropdown items={acc.items(u)} onItemClick={({ detail }) => acc.ejecutar(detail.id, u)} />{acc.modales}
 */
export function useAccionesUsuario({ enDetalle = false, alEliminar }: { enDetalle?: boolean; alEliminar?: () => void } = {}) {
  const { puede } = useSesion();
  const navegar = useNavigate();
  const { notificar } = useNotificaciones();
  const [pendiente, setPendiente] = useState<{ accion: AccionUsuario; usuario: Usuario } | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [errorRestablecer, setErrorRestablecer] = useState<string | null>(null);

  const estado = useCambiarEstadoUsuario();
  const sesiones = useCerrarSesionesUsuario();
  const eliminar = useEliminarUsuario();
  const restablecer = useRestablecerContrasena();

  const modificar = puede(PERMISOS.MODIFICAR_USUARIOS);

  function items(u: Usuario): ButtonDropdownProps.ItemOrGroup[] {
    const bloqueo = u.protegido ? MOTIVO_PROTEGIDO : undefined;
    const con = (id: AccionUsuario, text: string, bloqueable = true): ButtonDropdownProps.Item => ({
      id,
      text,
      disabled: bloqueable && !!bloqueo,
      disabledReason: bloqueo,
    });
    const lista: ButtonDropdownProps.ItemOrGroup[] = [];
    if (!enDetalle) lista.push({ id: "detalle", text: "Ver detalle" });
    if (modificar && !enDetalle) lista.push(con("editar", "Editar"));
    if (modificar)
      lista.push(
        con("restablecer", "Restablecer contraseña"),
        con("cerrarSesiones", "Cerrar sesiones"),
        u.activo ? con("desactivar", "Desactivar") : con("activar", "Activar"),
      );
    if (puede(PERMISOS.VER_MONITOREO)) lista.push({ id: "actividad", text: "Ver actividad" });
    if (puede(PERMISOS.ELIMINAR_USUARIOS)) lista.push(con("eliminar", "Eliminar"));
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

  function ejecutar(id: string, u: Usuario) {
    const accion = id as AccionUsuario;
    if (accion === "detalle") navegar(`/usuarios/${u.id}`);
    else if (accion === "editar") navegar(`/usuarios/${u.id}/editar`);
    else if (accion === "actividad") navegar(`/actividad?actorId=${u.id}&rango=7d`);
    else if (accion === "activar")
      estado.mutate({ id: u.id, activo: true }, { onSuccess: listo(`El usuario ${login(u.usuario)} quedó activo.`), onError: fallo("No se pudo activar") });
    else {
      setErrorRestablecer(null);
      abrirModal({ accion, usuario: u });
    }
  }

  let modales: React.ReactNode = null;
  if (pendiente) {
    const u = pendiente.usuario;
    const quien = `${u.nombre} ${u.apellido} (${login(u.usuario)})`;
    const cancelar = () => setPendiente(null);
    const clave = `${pendiente.accion}-${u.id}`;
    if (pendiente.accion === "desactivar") {
      modales = (
        <ModalConfirmacion
          error={errorModal}
          key={clave}
          titulo={`¿Desactivar a ${quien}?`}
          boton="Desactivar"
          conMotivo
          procesando={estado.isPending}
          onCancelar={cancelar}
          onConfirmar={(motivo) =>
            estado.mutate({ id: u.id, activo: false, motivo }, { onSuccess: listo(`El usuario ${login(u.usuario)} quedó inactivo.`), onError: falloModal })
          }
        >
          No podrá iniciar sesión y sus sesiones abiertas dejarán de funcionar. Sus roles y permisos se conservan y podrás reactivarlo.
        </ModalConfirmacion>
      );
    } else if (pendiente.accion === "cerrarSesiones") {
      modales = (
        <ModalConfirmacion
          error={errorModal}
          key={clave}
          titulo={`¿Cerrar las sesiones de ${quien}?`}
          boton="Cerrar sesiones"
          conMotivo
          procesando={sesiones.isPending}
          onCancelar={cancelar}
          onConfirmar={(motivo) =>
            sesiones.mutate(
              { id: u.id, motivo },
              { onSuccess: listo(`Se cerraron las sesiones de ${login(u.usuario)}. Deberá iniciar sesión de nuevo.`), onError: falloModal },
            )
          }
        >
          Sus sesiones abiertas dejarán de funcionar al instante y tendrá que iniciar sesión de nuevo. La cuenta, sus roles y permisos no cambian.
        </ModalConfirmacion>
      );
    } else if (pendiente.accion === "eliminar") {
      modales = (
        <ModalConfirmacion
          error={errorModal}
          key={clave}
          titulo={`¿Eliminar a ${quien}?`}
          boton="Eliminar"
          procesando={eliminar.isPending}
          onCancelar={cancelar}
          onConfirmar={() =>
            eliminar.mutate(u.id, {
              onSuccess: () => {
                listo(`Se eliminó el usuario ${login(u.usuario)}.`)();
                alEliminar?.();
              },
              onError: falloModal,
            })
          }
        >
          Se eliminará la cuenta con sus roles y ajustes individuales. Esta acción no se puede deshacer; si solo quieres impedir el acceso, desactívala.
        </ModalConfirmacion>
      );
    } else if (pendiente.accion === "restablecer") {
      modales = (
        <ModalRestablecer
          key={clave}
          usuario={login(u.usuario)}
          procesando={restablecer.isPending}
          error={errorRestablecer}
          errorGeneral={errorModal}
          onCancelar={cancelar}
          onConfirmar={(contrasena) =>
            restablecer.mutate(
              { id: u.id, contrasena },
              {
                onSuccess: listo(`Se restableció la contraseña de ${login(u.usuario)}.`),
                onError: (e) => (e instanceof ErrorApi && e.campos.contrasena ? setErrorRestablecer(e.campos.contrasena) : falloModal(e)),
              },
            )
          }
        />
      );
    }
  }

  return { items, ejecutar, modales, ocupado: estado.isPending };
}
