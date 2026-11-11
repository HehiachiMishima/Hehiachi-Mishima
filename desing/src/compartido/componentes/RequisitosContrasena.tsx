import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { REGLAS_CONTRASENA } from "@/compartido/util/contrasena";

/** Requisitos de la contraseña con su cumplimiento en vivo (icono + texto, no solo color). */
export function RequisitosContrasena({ valor }: { valor: string }) {
  return (
    <SpaceBetween size="xxs">
      {REGLAS_CONTRASENA.map((r) => {
        const ok = r.cumple(valor);
        return (
          <StatusIndicator key={r.id} type={ok ? "success" : valor ? "error" : "pending"}>
            {r.texto}
          </StatusIndicator>
        );
      })}
    </SpaceBetween>
  );
}
