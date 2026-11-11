import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Link from "@cloudscape-design/components/link";
import SegmentedControl from "@cloudscape-design/components/segmented-control";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import { CategoriaAccion } from "@/compartido/componentes/Insignias";
import { EstadoVacio } from "@/compartido/componentes/EstadoVacio";
import { useSeguirEnlace } from "@/compartido/navegacion";
import { fechaHora, haceCuanto } from "@/compartido/util/formato";
import { mensajeDeError } from "@/core/api/errores";
import { auditoriaApi } from "./api";
import { actorDeEvento, etiquetaAccion, objetivoDeEvento, resultadoDe } from "./etiquetas";
import type { FiltroAuditoria } from "./tipos";

type Modo = "registro" | "actor";

/**
 * Últimos eventos de auditoría de un registro (relacionadoCon=TIPO:id) y, si se indica actorId,
 * también lo que hizo esa persona. Enlaza a la bitácora completa.
 */
export function Historial({ relacionadoCon, actorId }: { relacionadoCon: string; actorId?: number }) {
  const [modo, setModo] = useState<Modo>("registro");
  const seguir = useSeguirEnlace();
  const filtro: FiltroAuditoria = modo === "actor" && actorId ? { actorId, pagina: 1, tamano: 15 } : { relacionadoCon, pagina: 1, tamano: 15 };
  const consulta = useQuery({ queryKey: ["historial", filtro], queryFn: ({ signal }) => auditoriaApi.buscar(filtro, signal) });
  const enlace = modo === "actor" && actorId ? `/auditoria?actorId=${actorId}&rango=30d` : `/auditoria?relacionadoCon=${encodeURIComponent(relacionadoCon)}&rango=30d`;

  return (
    <SpaceBetween size="m">
      {actorId !== undefined && (
        <SegmentedControl
          label="Qué eventos mostrar"
          selectedId={modo}
          onChange={({ detail }) => setModo(detail.selectedId as Modo)}
          options={[
            { id: "registro", text: "Cambios sobre este registro" },
            { id: "actor", text: "Lo que hizo esta persona" },
          ]}
        />
      )}
      {consulta.isError ? (
        <Alert type="error" action={<Button onClick={() => void consulta.refetch()}>Reintentar</Button>}>
          {mensajeDeError(consulta.error, "No se pudo cargar el historial.")}
        </Alert>
      ) : (
        <Table
          variant="embedded"
          items={consulta.data?.contenido ?? []}
          loading={consulta.isPending}
          loadingText="Cargando historial"
          trackBy="id"
          ariaLabels={{ tableLabel: "Historial" }}
          empty={<EstadoVacio titulo="Sin eventos" texto="Aún no hay eventos registrados." />}
          columnDefinitions={[
            {
              id: "accion",
              header: "Acción",
              isRowHeader: true,
              cell: (e) => <StatusIndicator type={resultadoDe(e.resultado).tipo}>{etiquetaAccion(e.accion)}</StatusIndicator>,
            },
            { id: "categoria", header: "Categoría", cell: (e) => <CategoriaAccion accion={e.accion} /> },
            { id: "quien", header: modo === "actor" ? "Sobre" : "Quién", cell: (e) => (modo === "actor" ? objetivoDeEvento(e) : actorDeEvento(e)) },
            {
              id: "cuando",
              header: "Cuándo",
              cell: (e) => (
                <span title={fechaHora(e.ocurridoEn)}>
                  {haceCuanto(e.ocurridoEn)}
                </span>
              ),
            },
          ]}
        />
      )}
      <Box>
        <Link href={enlace} onFollow={seguir}>
          Ver en la bitácora completa
        </Link>
      </Box>
    </SpaceBetween>
  );
}
