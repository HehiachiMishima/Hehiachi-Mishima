import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import ProgressBar from "@cloudscape-design/components/progress-bar";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { Indicador } from "@/compartido/componentes/Indicador";
import { useSeguirEnlace } from "@/compartido/navegacion";
import { numero, porcentaje } from "@/compartido/util/formato";
import type { KpisAdmin } from "../tipos";

/** Cifras de identidades y accesos, cada una con su enlace a la lista que la explica. */
export function IndicadoresAcceso({ kpis }: { kpis: KpisAdmin | undefined }) {
  const seguir = useSeguirEnlace();
  const ir = (href: string, texto: string) => (
    <Link href={href} onFollow={seguir} variant="secondary">
      {texto}
    </Link>
  );
  const k = kpis;
  return (
    <Container header={<Header variant="h2" description="Cuentas, roles, permisos y excepciones individuales">Identidades y accesos</Header>}>
      <ColumnLayout columns={4} variant="text-grid" minColumnWidth={170}>
        <Indicador
          titulo="Cuentas activas"
          valor={k ? numero(k.usuariosActivos) : "—"}
          detalle={k ? `de ${numero(k.usuarios)}` : undefined}
          estado={k && <ProgressBar value={porcentaje(k.usuariosActivos, k.usuarios)} ariaLabel="Porcentaje de cuentas activas" status={k.usuariosActivos === k.usuarios ? "success" : "in-progress"} resultText="Todas activas" />}
          enlace={ir("/usuarios?estado=Activo", "Ver cuentas")}
        />
        <Indicador
          titulo="Cuentas sin rol"
          valor={k ? numero(k.usuariosSinRol) : "—"}
          estado={
            k &&
            (k.usuariosSinRol > 0 ? (
              <StatusIndicator type="warning">Revisar</StatusIndicator>
            ) : (
              <StatusIndicator type="success">Todas tienen rol</StatusIndicator>
            ))
          }
          enlace={k && k.usuariosSinRol > 0 ? ir("/usuarios?sinRol=1", "Revisar cuentas") : undefined}
        />
        <Indicador
          titulo="Excepciones individuales"
          valor={k ? numero(k.overridesGrant + k.overridesDeny) : "—"}
          detalle={k ? `${numero(k.overridesGrant)} concedidas · ${numero(k.overridesDeny)} denegadas` : undefined}
          estado={k && k.overridesGrant > 0 ? <StatusIndicator type="warning">Concesiones fuera de los roles</StatusIndicator> : undefined}
        />
        <Indicador
          titulo="Roles y permisos activos"
          valor={k ? `${numero(k.rolesActivos)} · ${numero(k.permisosActivos)}` : "—"}
          detalle={k ? `de ${numero(k.roles)} roles y ${numero(k.permisos)} permisos` : undefined}
          estado={k && <ProgressBar value={porcentaje(k.permisosActivos, k.permisos)} ariaLabel="Porcentaje de permisos activos" description="Permisos activos" />}
          enlace={ir("/roles", "Ver roles")}
        />
      </ColumnLayout>
    </Container>
  );
}
