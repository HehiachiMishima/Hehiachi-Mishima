import { useState } from "react";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Checkbox from "@cloudscape-design/components/checkbox";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { ErrorApi, mensajeDeError } from "@/core/api/errores";

/** Datos de un elemento de catálogo (rol o permiso): mismo formulario, distinto texto. */
export interface DatosCatalogo {
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

/**
 * Alta o edición de un rol o permiso. Valida en cliente lo obvio y muestra los errores por campo
 * que devuelva el servidor (p. ej. nombre duplicado). Montarlo por elemento (con `key`).
 */
export function ModalCatalogo({
  entidad,
  inicial,
  ejemploNombre,
  onGuardar,
  onCancelar,
}: {
  entidad: "rol" | "permiso";
  inicial: DatosCatalogo | null;
  ejemploNombre: string;
  onGuardar: (datos: DatosCatalogo) => Promise<unknown>;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [enviado, setEnviado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<{ general?: string; campos: Record<string, string> }>({ campos: {} });

  const errorNombre = error.campos.nombre ?? (enviado && !nombre.trim() ? "El nombre es obligatorio." : nombre.length > 100 ? "Máximo 100 caracteres." : undefined);
  const errorDescripcion = error.campos.descripcion ?? (descripcion.length > 255 ? "Máximo 255 caracteres." : undefined);

  const guardar = async () => {
    setEnviado(true);
    if (!nombre.trim() || errorNombre || errorDescripcion) return;
    setGuardando(true);
    setError({ campos: {} });
    try {
      await onGuardar({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, activo });
    } catch (e) {
      const campos = e instanceof ErrorApi ? e.campos : {};
      setError({ campos, general: Object.keys(campos).length ? undefined : mensajeDeError(e) });
    } finally {
      setGuardando(false);
    }
  };

  const etiqueta = entidad === "rol" ? "rol" : "permiso";
  return (
    <Modal
      visible
      onDismiss={onCancelar}
      header={inicial ? `Editar ${etiqueta}` : `Crear ${etiqueta}`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button variant="primary" loading={guardando} onClick={() => void guardar()}>
              {inicial ? "Guardar cambios" : `Crear ${etiqueta}`}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <form onSubmit={(e) => (e.preventDefault(), void guardar())}>
        <Form errorText={error.general}>
          <SpaceBetween size="m">
            <FormField label="Nombre" errorText={errorNombre} constraintText="Máximo 100 caracteres.">
              <Input value={nombre} placeholder={ejemploNombre} onChange={({ detail }) => setNombre(detail.value)} autoFocus />
            </FormField>
            <FormField label={<>Descripción <i>- opcional</i></>} errorText={errorDescripcion} constraintText={`${descripcion.length}/255`}>
              <Textarea value={descripcion} placeholder={`Para qué sirve este ${etiqueta}`} onChange={({ detail }) => setDescripcion(detail.value)} rows={3} />
            </FormField>
            <Checkbox checked={activo} onChange={({ detail }) => setActivo(detail.checked)} description={entidad === "rol" ? "Solo los roles activos conceden permisos." : "Un permiso inactivo no concede acceso."}>
              {entidad === "rol" ? "Rol activo" : "Permiso activo"}
            </Checkbox>
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
}
