import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";

const HORA = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });

/** "¿Sigues ahí?" (WCAG 2.2.1): una acción para seguir. Cerrar el aviso también cuenta como seguir. */
export function AvisoInactividad({ cierraA, onSeguir, onSalir }: { cierraA: Date | null; onSeguir: () => void; onSalir: () => void }) {
  return (
    <Modal
      visible={cierraA !== null}
      onDismiss={onSeguir}
      header="¿Sigues ahí?"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onSalir}>
              Cerrar sesión
            </Button>
            <Button variant="primary" onClick={onSeguir}>
              Seguir conectado
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      No detectamos actividad. Por seguridad, tu sesión se cerrará a las{" "}
      <Box variant="span" fontWeight="bold">
        {cierraA ? HORA.format(cierraA) : ""}
      </Box>
      . Si sigues trabajando, no tendrás que volver a escribir tu contraseña.
    </Modal>
  );
}
