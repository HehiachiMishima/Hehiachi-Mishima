import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Grid from "@cloudscape-design/components/grid";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SegmentedControl from "@cloudscape-design/components/segmented-control";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Tabs from "@cloudscape-design/components/tabs";
import Toggle from "@cloudscape-design/components/toggle";
import { useSeguirEnlace } from "@/compartido/navegacion";
import { haceCuanto, login } from "@/compartido/util/formato";
import { mensajeDeError } from "@/core/api/errores";
import { EstadoSistema } from "./componentes/EstadoSistema";
import { GraficosTrafico } from "./componentes/GraficosTrafico";
import { IndicadoresTrafico } from "./componentes/IndicadoresTrafico";
import { Infraestructura } from "./componentes/Infraestructura";
import { TablaConectados } from "./componentes/TablaConectados";
import { TablaEndpoints } from "./componentes/TablaEndpoints";
import { TablaIncidencias } from "./componentes/TablaIncidencias";
import { claves, useIncidencias, useResumen, useRutas, useSerie, useUsuariosActivos } from "./consultas";
import type { PeticionTraza, VentanaMinutos } from "./tipos";

const VENTANAS: { id: `${VentanaMinutos}`; text: string }[] = [
  { id: "5", text: "5 min" },
  { id: "15", text: "15 min" },
  { id: "60", text: "1 h" },
];

/**
 * Monitoreo en vivo. Distribución: estado + cifras arriba (lo primero que se mira), tendencias,
 * infraestructura y el detalle en pestañas (endpoints, incidencias, conectados).
 */
export default function MonitoreoPagina() {
  const [minutos, setMinutos] = useState<VentanaMinutos>(15);
  const [enVivo, setEnVivo] = useState(true);
  const cliente = useQueryClient();
  const seguir = useSeguirEnlace();

  const resumen = useResumen(minutos, enVivo);
  const serie = useSerie(enVivo);
  const rutas = useRutas(minutos, enVivo);
  const activos = useUsuariosActivos(enVivo);
  const incidencias = useIncidencias(enVivo);

  const todas = [resumen, serie, rutas, activos, incidencias];
  const actualizando = todas.some((q) => q.isFetching);
  const error = todas.find((q) => q.error)?.error;
  const reintentar = () => void cliente.invalidateQueries({ queryKey: claves.todo });

  const rango = minutos <= 60 ? "1h" : "24h";
  const aTraza = (p: PeticionTraza) => (
    <Link href={p.idCorrelacion ? `/actividad?idCorrelacion=${encodeURIComponent(p.idCorrelacion)}` : `/actividad?ruta=${encodeURIComponent(p.ruta)}&rango=1h`} onFollow={seguir}>
      {`${p.metodo} ${p.uri}`}
    </Link>
  );
  const errores = incidencias.data?.errores ?? [];
  const lentas = incidencias.data?.lentas ?? [];
  const conectados = activos.data ?? [];

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description={resumen.dataUpdatedAt ? `Estado en vivo de la API · actualizado ${haceCuanto(new Date(resumen.dataUpdatedAt))}` : "Estado en vivo de la API"}
          actions={
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <SegmentedControl
                label="Ventana de tiempo"
                selectedId={String(minutos)}
                options={VENTANAS}
                onChange={({ detail }) => setMinutos(Number(detail.selectedId) as VentanaMinutos)}
              />
              <Toggle checked={enVivo} onChange={({ detail }) => setEnVivo(detail.checked)}>
                En vivo
              </Toggle>
              <Button iconName="refresh" ariaLabel="Actualizar ahora" loading={actualizando} onClick={reintentar} />
            </SpaceBetween>
          }
        >
          Monitoreo
        </Header>
      }
    >
      <SpaceBetween size="l">
        {error && (
          <Alert type="error" header="No se pudo actualizar" action={<Button onClick={reintentar}>Reintentar</Button>}>
            {mensajeDeError(error, "No se pudo obtener el estado del sistema.")}
            {resumen.data && " Se muestran los últimos datos obtenidos."}
          </Alert>
        )}
        <Grid gridDefinition={[{ colspan: { default: 12, m: 4 } }, { colspan: { default: 12, m: 8 } }]}>
          <EstadoSistema sistema={resumen.data?.sistema} />
          <IndicadoresTrafico resumen={resumen.data} minutos={minutos} />
        </Grid>
        <GraficosTrafico serie={serie.data ?? []} estado={serie.isError && !serie.data ? "error" : serie.data ? "finished" : "loading"} onReintentar={reintentar} />
        <Infraestructura sistema={resumen.data?.sistema} />
        <Tabs
          variant="container"
          ariaLabel="Detalle del tráfico"
          tabs={[
            {
              id: "endpoints",
              label: `Endpoints (${rutas.data?.length ?? 0})`,
              content: (
                <TablaEndpoints
                  rutas={rutas.data ?? []}
                  cargando={rutas.isPending}
                  enlace={(r) => (
                    <Link href={`/actividad?metodo=${r.metodo}&ruta=${encodeURIComponent(r.ruta)}&rango=${rango}`} onFollow={seguir}>
                      {`${r.metodo} ${r.ruta}`}
                    </Link>
                  )}
                />
              ),
            },
            {
              id: "errores",
              label: `Errores recientes (${errores.length})`,
              content: <TablaIncidencias tipo="errores" peticiones={errores} cargando={incidencias.isPending} umbralMs={incidencias.data?.umbralLentoMs ?? 1000} enlace={aTraza} />,
            },
            {
              id: "lentas",
              label: `Peticiones lentas (${lentas.length})`,
              content: <TablaIncidencias tipo="lentas" peticiones={lentas} cargando={incidencias.isPending} umbralMs={incidencias.data?.umbralLentoMs ?? 1000} enlace={aTraza} />,
            },
            {
              id: "conectados",
              label: `Conectados (${conectados.length})`,
              content: (
                <TablaConectados
                  presentes={conectados}
                  cargando={activos.isPending}
                  enlace={(p) => (
                    <Link href={`/actividad?actorId=${p.actorId}`} onFollow={seguir}>
                      {login(p.usuario ?? `#${p.actorId}`)}
                    </Link>
                  )}
                />
              ),
            },
          ]}
        />
      </SpaceBetween>
    </ContentLayout>
  );
}
