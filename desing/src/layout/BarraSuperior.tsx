import { useNavigate } from "react-router";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import { ENTORNO } from "@/config/entorno";
import { usePreferencias } from "@/core/preferencias/usePreferencias";
import { cerrarSesion } from "@/core/sesion/autenticacion";
import { useSesion } from "@/core/sesion/useSesion";

/** Identidad, preferencias visuales y cuenta. Va fuera de AppLayout (AppLayout la mide con headerSelector). */
export function BarraSuperior() {
  const { usuario } = useSesion();
  const { prefs, cambiar } = usePreferencias();
  const navegar = useNavigate();

  return (
    <div id="cabecera">
      <TopNavigation
        identity={{ href: "/", title: ENTORNO.nombreProducto, onFollow: (e) => (e.preventDefault(), navegar("/")) }}
        utilities={[
          {
            type: "menu-dropdown",
            iconName: "settings",
            ariaLabel: "Preferencias",
            title: "Preferencias",
            items: [
              {
                id: "tema",
                text: "Tema",
                items: [
                  { id: "claro", text: "Claro", checked: prefs.tema === "claro", itemType: "checkbox" },
                  { id: "oscuro", text: "Oscuro", checked: prefs.tema === "oscuro", itemType: "checkbox" },
                  { id: "sistema", text: "Según el sistema", checked: prefs.tema === "sistema", itemType: "checkbox" },
                ],
              },
              {
                id: "densidad",
                text: "Densidad",
                items: [
                  { id: "comodo", text: "Cómoda", checked: !prefs.compacto, itemType: "checkbox" },
                  { id: "compacto", text: "Compacta", checked: prefs.compacto, itemType: "checkbox" },
                ],
              },
            ],
            onItemClick: ({ detail }) => {
              if (detail.id === "claro" || detail.id === "oscuro" || detail.id === "sistema") cambiar({ tema: detail.id });
              if (detail.id === "comodo" || detail.id === "compacto") cambiar({ compacto: detail.id === "compacto" });
            },
          },
          {
            type: "menu-dropdown",
            text: usuario ? `${usuario.nombre} ${usuario.apellido}` : "Cuenta",
            description: usuario?.email,
            iconName: "user-profile",
            items: [
              { id: "cuenta", text: "Mi cuenta", href: "/cuenta" },
              { id: "salir", text: "Cerrar sesión" },
            ],
            onItemFollow: (e) => {
              if (e.detail.href) {
                e.preventDefault();
                navegar(e.detail.href);
              }
            },
            onItemClick: ({ detail }) => detail.id === "salir" && cerrarSesion(),
          },
        ]}
        i18nStrings={{ overflowMenuTriggerText: "Más", overflowMenuTitleText: "Todo" }}
      />
    </div>
  );
}
