import { Suspense, useCallback, useMemo, useState } from "react";
import { Outlet, useMatches } from "react-router";
import AppLayout, { type AppLayoutProps } from "@cloudscape-design/components/app-layout";
import BreadcrumbGroup, { type BreadcrumbGroupProps } from "@cloudscape-design/components/breadcrumb-group";
import Box from "@cloudscape-design/components/box";
import Flashbar from "@cloudscape-design/components/flashbar";
import HelpPanel from "@cloudscape-design/components/help-panel";
import Icon from "@cloudscape-design/components/icon";
import List from "@cloudscape-design/components/list";
import SpaceBetween from "@cloudscape-design/components/space-between";
import SplitPanel from "@cloudscape-design/components/split-panel";
import type { DatosRuta } from "@/app/rutas";
import { CargandoPagina } from "@/compartido/componentes/CargandoPagina";
import { ContextoMarco, type PanelDivididoDef, type ValorMarco } from "@/compartido/marco/contexto";
import { useSeguirEnlace } from "@/compartido/navegacion";
import { useNotificaciones } from "@/core/notificaciones/contexto";
import { rutaDe } from "@/modulos/registro";
import { BarraSuperior } from "./BarraSuperior";
import { MenuLateral } from "./MenuLateral";

/**
 * Marco de la consola autenticada: barra superior, menú, migas, avisos, panel dividido y la página
 * de la ruta. Las páginas le hablan a través de ContextoMarco (migas extra, tipo, panel de detalle).
 */
export function Shell() {
  const [navAbierta, setNavAbierta] = useState(true);
  const [migasPagina, setMigasPagina] = useState<BreadcrumbGroupProps.Item[]>([]);
  const [tipoPagina, setTipoPagina] = useState<AppLayoutProps.ContentType | null>(null);
  const [panel, setPanel] = useState<PanelDivididoDef | null>(null);
  const [contenedorPanel, setContenedorPanel] = useState<HTMLElement | null>(null);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [prefsPanel, setPrefsPanel] = useState<AppLayoutProps.SplitPanelPreferences>({ position: "side" });
  const { avisos } = useNotificaciones();
  const seguir = useSeguirEnlace();
  const datos = useMatches()
    .map((m) => m.handle as DatosRuta | undefined)
    .findLast((h) => h?.modulo || h?.titulo);

  const fijarMigas = useCallback((m: BreadcrumbGroupProps.Item[]) => setMigasPagina(m), []);
  const fijarTipo = useCallback((t: AppLayoutProps.ContentType | null) => setTipoPagina(t), []);
  const fijarPanel = useCallback((p: PanelDivididoDef | null) => setPanel(p), []);
  const abrirAyuda = useCallback(() => setAyudaAbierta(true), []);
  const marco = useMemo<ValorMarco>(
    () => ({ fijarMigas, fijarTipo, fijarPanel, abrirAyuda, contenedorPanel }),
    [fijarMigas, fijarTipo, fijarPanel, abrirAyuda, contenedorPanel],
  );
  const modulo = datos?.modulo;
  // Tableros con cabecera de alto contraste (la página usa ContentLayout headerVariant="high-contrast").
  const destacada = modulo?.tipoContenido === "dashboard" && migasPagina.length === 0;

  const migas: BreadcrumbGroupProps.Item[] = [{ text: "Administración", href: "/" }];
  if (datos?.modulo) migas.push({ text: datos.modulo.titulo, href: rutaDe(datos.modulo) });
  else if (datos?.titulo) migas.push({ text: datos.titulo, href: datos.ruta ?? "/" });
  migas.push(...migasPagina);

  return (
    <ContextoMarco.Provider value={marco}>
      <BarraSuperior />
      <AppLayout
        headerSelector="#cabecera"
        contentType={tipoPagina ?? datos?.modulo?.tipoContenido ?? "default"}
        navigationOpen={navAbierta}
        onNavigationChange={({ detail }) => setNavAbierta(detail.open)}
        navigation={<MenuLateral />}
        breadcrumbs={<BreadcrumbGroup items={migas} onFollow={seguir} ariaLabel="Migas de pan" expandAriaLabel="Mostrar ruta" />}
        notifications={<Flashbar items={avisos} stackItems={avisos.length > 2} />}
        stickyNotifications
        headerVariant={destacada ? "high-contrast" : "default"}
        toolsHide={!modulo}
        toolsOpen={ayudaAbierta}
        onToolsChange={({ detail }) => setAyudaAbierta(detail.open)}
        tools={
          modulo && (
            <HelpPanel header={<h2>{modulo.titulo}</h2>}>
              <SpaceBetween size="m">
                <Box variant="p">{modulo.ayuda.resumen}</Box>
                <List
                  ariaLabel="Claves de esta página"
                  disablePaddings
                  items={modulo.ayuda.puntos}
                  renderItem={(p) => ({ id: p, icon: <Icon name="status-info" variant="link" />, content: p })}
                />
              </SpaceBetween>
            </HelpPanel>
          )
        }
        splitPanelOpen={!!panel}
        onSplitPanelToggle={({ detail }) => !detail.open && panel?.onCerrar()}
        splitPanelPreferences={prefsPanel}
        onSplitPanelPreferencesChange={({ detail }) => setPrefsPanel(detail)}
        splitPanel={
          panel ? (
            <SplitPanel header={panel.titulo} headerDescription={panel.descripcion} closeBehavior="hide">
              <div ref={setContenedorPanel} />
            </SplitPanel>
          ) : undefined
        }
        content={
          <Suspense fallback={<CargandoPagina />}>
            <Outlet />
          </Suspense>
        }
        ariaLabels={{
          navigation: "Navegación",
          navigationClose: "Cerrar navegación",
          navigationToggle: "Abrir navegación",
          notifications: "Notificaciones",
          tools: "Ayuda",
          toolsClose: "Cerrar ayuda",
          toolsToggle: "Abrir ayuda",
        }}
      />
    </ContextoMarco.Provider>
  );
}
