import { useState } from "react";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Toggle from "@cloudscape-design/components/toggle";
import { RequisitosContrasena } from "@/compartido/componentes/RequisitosContrasena";
import { contrasenaValida } from "@/compartido/util/contrasena";

/** Contraseña nueva para otra persona (se le comunica por un canal seguro). */
export function ModalRestablecer({
  usuario,
  procesando,
  error,
  onConfirmar,
  onCancelar,
}: {
  usuario: string;
  procesando: boolean;
  error: string | null;
  onConfirmar: (contrasena: string) => void;
  onCancelar: () => void;
}) {
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [ver, setVer] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const errorNueva = error ?? (enviado && !contrasenaValida(nueva) ? "La contraseña no cumple los requisitos." : undefined);
  const errorConfirmacion = enviado && confirmacion !== nueva ? "Las contraseñas no coinciden." : undefined;

  const confirmar = () => {
    setEnviado(true);
    if (contrasenaValida(nueva) && nueva === confirmacion) onConfirmar(nueva);
  };

  return (
    <Modal
      visible
      onDismiss={onCancelar}
      header={`Restablecer la contraseña de ${usuario}`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button variant="primary" loading={procesando} onClick={confirmar}>
              Restablecer contraseña
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Alert type="info">Deberá usar esta contraseña en su próximo inicio de sesión. Comunícasela por un canal seguro. El cambio queda en la auditoría.</Alert>
        <FormField label="Contraseña nueva" errorText={errorNueva}>
          <SpaceBetween size="xs">
            <Input type={ver ? "text" : "password"} value={nueva} autoComplete="new-password" onChange={({ detail }) => setNueva(detail.value)} autoFocus />
            <RequisitosContrasena valor={nueva} />
          </SpaceBetween>
        </FormField>
        <FormField label="Confirmar contraseña" errorText={errorConfirmacion}>
          <Input type={ver ? "text" : "password"} value={confirmacion} autoComplete="new-password" onChange={({ detail }) => setConfirmacion(detail.value)} />
        </FormField>
        <Toggle checked={ver} onChange={({ detail }) => setVer(detail.checked)}>
          Mostrar contraseñas
        </Toggle>
      </SpaceBetween>
    </Modal>
  );
}
