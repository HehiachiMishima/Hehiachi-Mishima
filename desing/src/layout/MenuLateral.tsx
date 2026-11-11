import { useLocation } from "react-router";
import SideNavigation, { type SideNavigationProps } from "@cloudscape-design/components/side-navigation";
import { useSeguirEnlace } from "@/compartido/navegacion";
import { ENTORNO } from "@/config/entorno";
import { useSesion } from "@/core/sesion/useSesion";
import { menuPorGrupos, rutaDe } from "@/modulos/registro";

/** Menú generado desde el registro de módulos y filtrado por permisos. */
export function MenuLateral() {
  const { permisos } = useSesion();
  const { pathname } = useLocation();
  const seguir = useSeguirEnlace();

  const items: SideNavigationProps.Item[] = [
    ...menuPorGrupos(permisos).map(
      (g): SideNavigationProps.Item => ({
        type: "section",
        text: g.titulo,
        items: g.modulos.map((m) => ({ type: "link", text: m.titulo, href: rutaDe(m) })),
      }),
    ),
    { type: "divider" },
    { type: "link", text: "Consola completa (Angular)", href: ENTORNO.consolaAngularUrl, external: true, externalIconAriaLabel: "Abre en una pestaña nueva" },
  ];

  // Activo = primer segmento (/usuarios/42 marca "Usuarios").
  const activo = `/${pathname.split("/")[1] ?? ""}`;
  return <SideNavigation header={{ href: "/", text: "Administración" }} activeHref={activo} onFollow={seguir} items={items} />;
}
