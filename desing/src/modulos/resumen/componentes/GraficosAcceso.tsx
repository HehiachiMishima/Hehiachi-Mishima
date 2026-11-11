import BarChart from "@cloudscape-design/components/bar-chart";
import Container from "@cloudscape-design/components/container";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { mes } from "@/compartido/util/formato";
import { etiquetaPermiso } from "@/core/sesion/permisos";
import type { AnaliticaAdmin } from "../tipos";

type Estado = "loading" | "finished" | "error";

/** Distribución del acceso: usuarios por rol, permisos más extendidos y altas por mes. */
export function GraficosAcceso({ datos, estado, onReintentar }: { datos: AnaliticaAdmin | undefined; estado: Estado; onReintentar: () => void }) {
  const porRol = [...(datos?.usuariosPorRol ?? [])].sort((a, b) => b.valor - a.valor);
  const permisos = (datos?.permisosMasOtorgados ?? []).slice(0, 10);
  const altas = datos?.altasPorMes ?? [];
  const comun = { statusType: estado, hideFilter: true, onRecoveryClick: onReintentar, height: 240 } as const;
  const col = { colspan: { default: 12, s: 6, m: 4 } };

  return (
    <Grid gridDefinition={[col, col, { colspan: { default: 12, m: 4 } }]}>
      <Container fitHeight header={<Header variant="h2" description="Roles sin usuarios son candidatos a limpieza">Usuarios por rol</Header>}>
        <BarChart
          {...comun}
          horizontalBars
          hideLegend
          xScaleType="categorical"
          ariaLabel="Usuarios por rol"
          series={[{ title: "Usuarios", type: "bar", data: porRol.map((c) => ({ x: c.etiqueta, y: c.valor })) }]}
          empty={<EstadoVacio titulo="Sin roles" texto="Aún no hay roles." />}
        />
      </Container>
      <Container fitHeight header={<Header variant="h2" description="Usuarios con cada permiso, ya aplicadas las denegaciones">Permisos más extendidos</Header>}>
        <BarChart
          {...comun}
          horizontalBars
          hideLegend
          xScaleType="categorical"
          ariaLabel="Permisos más otorgados"
          series={[{ title: "Usuarios", type: "bar", data: permisos.map((c) => ({ x: etiquetaPermiso(c.etiqueta), y: c.valor })) }]}
          empty={<EstadoVacio titulo="Sin datos" texto="Aún no hay permisos otorgados." />}
        />
      </Container>
      <Container fitHeight header={<Header variant="h2" description="Altas por mes en los últimos 12 meses">Crecimiento de cuentas</Header>}>
        <BarChart
          {...comun}
          xScaleType="categorical"
          ariaLabel="Altas de cuentas por mes"
          xTitle="Mes"
          yTitle="Cuentas"
          series={[
            { title: "Altas", type: "bar", data: altas.map((p) => ({ x: mes(p.periodo), y: p.valor })) },
            { title: "Siguen activas", type: "bar", data: altas.map((p) => ({ x: mes(p.periodo), y: p.secundario })) },
          ]}
          empty={<EstadoVacio titulo="Sin altas" texto="No hubo altas en el periodo." />}
        />
      </Container>
    </Grid>
  );
}
