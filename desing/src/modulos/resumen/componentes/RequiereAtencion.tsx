import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Icon, { type IconProps } from "@cloudscape-design/components/icon";
import List from "@cloudscape-design/components/list";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import { useNavigate } from "react-router";
import { actorDeEvento, etiquetaAccion, objetivoDeEvento } from "@/compartido/auditoria/etiquetas";
import type { AuditoriaEvento } from "@/compartido/auditoria/tipos";
import { fechaHora, haceCuanto, plural } from "@/compartido/util/formato";
import type { KpisAdmin } from "../tipos";

interface Punto {
  clave: string;
  icono: IconProps.Name;
  variante: IconProps.Variant;
  texto: string;
  detalle?: string;
  href: string;
  enlace: string;
}

/** Lo que el administrador debería mirar hoy, cada punto con su icono de severidad y su acción. */
export function RequiereAtencion({ kpis, eventos }: { kpis: KpisAdmin | undefined; eventos: AuditoriaEvento[] | undefined }) {
  const navegar = useNavigate();
  const puntos: Punto[] = [];
  if (kpis?.usuariosSinRol) {
    puntos.push({ clave: "sin-rol", icono: "status-warning", variante: "warning", texto: `${plural(kpis.usuariosSinRol, "cuenta", "cuentas")} sin rol`, detalle: "No reciben permisos por rol.", href: "/usuarios?sinRol=1", enlace: "Revisar" });
  }
  if (kpis?.overridesDeny) {
    puntos.push({ clave: "deny", icono: "lock-private", variante: "info", texto: plural(kpis.overridesDeny, "denegación individual activa", "denegaciones individuales activas"), href: "/usuarios", enlace: "Ver usuarios" });
  }
  if (kpis?.overridesGrant) {
    puntos.push({ clave: "grant", icono: "key", variante: "warning", texto: `${plural(kpis.overridesGrant, "concesión individual", "concesiones individuales")} fuera de los roles`, href: "/usuarios", enlace: "Ver usuarios" });
  }
  for (const e of eventos ?? []) {
    puntos.push({
      clave: `ev-${e.id}`,
      icono: e.resultado === "DENEGADO" ? "security" : "status-negative",
      variante: "error",
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
        <List
          ariaLabel="Puntos que requieren atención"
          items={puntos}
          renderItem={(p) => ({
            id: p.clave,
            icon: <Icon name={p.icono} variant={p.variante} />,
            content: p.texto,
            secondaryContent: p.detalle && <Box variant="small" color="text-body-secondary">{p.detalle}</Box>,
            actions: (
              <Button variant="inline-link" onClick={() => navegar(p.href)}>
                {p.enlace}
              </Button>
            ),
          })}
        />
      )}
    </Container>
  );
}
