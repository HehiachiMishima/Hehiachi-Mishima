import Box from "@cloudscape-design/components/box";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import StatusIndicator, { type StatusIndicatorProps } from "@cloudscape-design/components/status-indicator";
import { actorDeEvento, etiquetaAccion, objetivoDeEvento } from "@/compartido/auditoria/etiquetas";
import type { AuditoriaEvento } from "@/compartido/auditoria/tipos";
import { useSeguirEnlace } from "@/compartido/navegacion";
import { fechaHora, haceCuanto, plural } from "@/compartido/util/formato";
import type { KpisAdmin } from "../tipos";

interface Punto {
  clave: string;
  tipo: StatusIndicatorProps.Type;
  texto: string;
  detalle?: string;
  href: string;
  enlace: string;
}

/** Lo que el administrador debería mirar hoy, cada punto con su acción. */
export function RequiereAtencion({ kpis, eventos }: { kpis: KpisAdmin | undefined; eventos: AuditoriaEvento[] | undefined }) {
  const seguir = useSeguirEnlace();
  const puntos: Punto[] = [];
  if (kpis?.usuariosSinRol) {
    puntos.push({ clave: "sin-rol", tipo: "warning", texto: `${plural(kpis.usuariosSinRol, "cuenta", "cuentas")} sin rol`, href: "/usuarios?sinRol=1", enlace: "Revisar" });
  }
  if (kpis?.overridesDeny) {
    puntos.push({ clave: "deny", tipo: "info", texto: `${plural(kpis.overridesDeny, "denegación individual activa", "denegaciones individuales activas")}`, href: "/usuarios", enlace: "Ver usuarios" });
  }
  if (kpis?.overridesGrant) {
    puntos.push({ clave: "grant", tipo: "warning", texto: `${plural(kpis.overridesGrant, "concesión individual", "concesiones individuales")} fuera de los roles`, href: "/usuarios", enlace: "Ver usuarios" });
  }
  for (const e of eventos ?? []) {
    puntos.push({
      clave: `ev-${e.id}`,
      tipo: e.resultado === "DENEGADO" ? "error" : "warning",
      texto: `${etiquetaAccion(e.accion)} · ${actorDeEvento(e)}`,
      detalle: `${objetivoDeEvento(e)} · ${haceCuanto(e.ocurridoEn)} (${fechaHora(e.ocurridoEn)})`,
      href: `/auditoria?evento=${e.id}&rango=30d`,
      enlace: "Ver detalle",
    });
  }

  return (
    <Container fitHeight header={<Header variant="h2" counter={kpis ? `(${puntos.length})` : undefined}>Requiere atención</Header>}>
      {!kpis ? (
        <StatusIndicator type="loading">Cargando</StatusIndicator>
      ) : puntos.length === 0 ? (
        <StatusIndicator type="success">Nada pendiente por ahora.</StatusIndicator>
      ) : (
        <SpaceBetween size="s">
          {puntos.map((p) => (
            <div key={p.clave}>
              <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                <StatusIndicator type={p.tipo}>{p.texto}</StatusIndicator>
                <Link href={p.href} onFollow={seguir}>
                  {p.enlace}
                </Link>
              </SpaceBetween>
              {p.detalle && (
                <Box variant="small" color="text-body-secondary">
                  {p.detalle}
                </Box>
              )}
            </div>
          ))}
        </SpaceBetween>
      )}
    </Container>
  );
}
