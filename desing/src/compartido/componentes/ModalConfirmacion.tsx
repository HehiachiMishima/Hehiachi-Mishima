import { useState, type ReactNode } from "react";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";

const MAX_MOTIVO = 200;

/**
 * Confirmación de una acción con consecuencias (patrón Cloudscape: Cancelar + verbo).
 * Con `conMotivo`, pide un motivo opcional que queda en la auditoría. Montarlo por acción
 * (con `key`) para que el motivo empiece vacío.
 */
export function ModalConfirmacion({
  titulo,
  children,
  boton,
  procesando,
  conMotivo = false,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  children: ReactNode;
  boton: string;
  procesando: boolean;
  conMotivo?: boolean;
  onConfirmar: (motivo: string | undefined) => void;
  onCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <Modal
      visible
      onDismiss={onCancelar}
      header={titulo}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button variant="primary" loading={procesando} onClick={() => onConfirmar(motivo.trim() || undefined)}>
              {boton}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box variant="p">{children}</Box>
        {conMotivo && (
          <FormField label="Motivo" description="Opcional. Queda registrado en la auditoría." constraintText={`${motivo.length}/${MAX_MOTIVO}`}>
            <Textarea value={motivo} onChange={({ detail }) => setMotivo(detail.value.slice(0, MAX_MOTIVO))} rows={2} />
          </FormField>
        )}
      </SpaceBetween>
    </Modal>
  );
}
