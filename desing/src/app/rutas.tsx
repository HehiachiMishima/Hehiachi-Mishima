import { createBrowserRouter, type RouteObject } from "react-router";
import { ErrorRuta } from "@/compartido/componentes/ErrorRuta";
import { Shell } from "@/layout/Shell";
import { MODULOS, type ModuloDef } from "@/modulos/registro";
import { LoginPagina } from "@/paginas/LoginPagina";
import { CuentaPagina } from "@/paginas/CuentaPagina";
import { NoEncontrada } from "@/compartido/componentes/NoEncontrada";
import { RequierePermiso, RequiereSesion, SoloInvitado } from "./guardas";
import { Inicio } from "./Inicio";

/** Datos de cada ruta (los leen el layout y las migas con useMatches). */
export interface DatosRuta {
  modulo?: ModuloDef;
  /** Páginas fuera del registro (p. ej. Mi cuenta): texto y ruta de su miga. */
  titulo?: string;
  ruta?: string;
}

function rutaDeModulo(m: ModuloDef): RouteObject {
  const Pagina = m.pagina;
  return {
    // "/*": cada módulo declara sus subrutas (detalle, alta, edición) con <Routes>.
    path: `${m.id}/*`,
    handle: { modulo: m } satisfies DatosRuta,
    element: (
      <RequierePermiso permiso={m.permiso}>
        <Pagina />
      </RequierePermiso>
    ),
    errorElement: <ErrorRuta />,
  };
}

export const rutas: RouteObject[] = [
  {
    path: "/login",
    element: (
      <SoloInvitado>
        <LoginPagina />
      </SoloInvitado>
    ),
  },
  {
    path: "/",
    element: (
      <RequiereSesion>
        <Shell />
      </RequiereSesion>
    ),
    errorElement: <ErrorRuta />,
    children: [
      { index: true, element: <Inicio /> },
      ...MODULOS.map(rutaDeModulo),
      { path: "cuenta", handle: { titulo: "Mi cuenta", ruta: "/cuenta" } satisfies DatosRuta, element: <CuentaPagina />, errorElement: <ErrorRuta /> },
      { path: "*", element: <NoEncontrada /> },
    ],
  },
];

export const crearRouter = () => createBrowserRouter(rutas);
