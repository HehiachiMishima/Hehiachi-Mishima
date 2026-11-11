# desing — consola Cloudscape (segundo frontend, solo local)

Segundo cliente del mismo backend Spring que usa `frontend/` (Angular), construido con los
componentes oficiales de [Cloudscape](https://cloudscape.design/components/)
(React 19 + Vite + TypeScript). **No entra en la imagen Docker ni en el CI**: solo se usa en local.

```bash
cd desing
npm install
npm run dev          # http://localhost:5173  (backend en :2003)
BACKEND_URL=http://localhost:2013 npm run dev   # otro backend
npm run verificar    # tipos + lint + pruebas + build
```

Vite reenvía `/api` al backend: app y API comparten origen, así que no hace falta tocar CORS y la
cookie HttpOnly del refresh token funciona igual que en producción.

## Arquitectura

Dependencias en una sola dirección: `app → layout → modulos/paginas → compartido → core → config`.
Un módulo nunca importa otro módulo ni el layout; lo común va a `compartido/` o `core/`, y la
navegación entre módulos es por URL (`/actividad?actorId=4`). `src/arquitectura.test.ts` lo comprueba.

Tiene los mismos módulos que la consola Angular:

| Grupo | Módulo | Qué incluye |
|---|---|---|
| Supervisión | Resumen | Indicadores de accesos, lo que requiere atención, seguridad (bitácora), gráficos y accesos rápidos |
| | Auditoría | Bitácora paginada en servidor, filtros en la URL, periodo, vistas guardadas, CSV, detalle con antes/después |
| | Monitoreo | Estado, tráfico, latencias, infraestructura y pestañas de endpoints, errores, lentas y conectados |
| | Actividad | Traza de peticiones con filtros, resumen por usuario (gráficos) y detalle de cada petición |
| Gestión | Usuarios | Lista con roles y permisos, alta/edición, detalle con roles, permisos efectivos (heredar/conceder/denegar) e historial, restablecer contraseña, sesiones, eliminar |
| | Roles | Lista, alta/edición, activar/desactivar con impacto, detalle con permisos (interruptores), usuarios e historial |
| | Permisos | Catálogo, alta/edición, detalle con los roles que lo conceden e historial |
| — | Mi cuenta | Datos, permisos propios y cambio de contraseña (menú de la cuenta) |

```
src/
├── main.tsx                 Estilos globales, tema/densidad antes del primer render
├── app/                     Composición de la aplicación
│   ├── App.tsx              Proveedores: i18n, caché de datos, sesión, avisos, router
│   ├── rutas.tsx            Rutas generadas desde el registro de módulos (+ límites de error)
│   ├── guardas.tsx          RequiereSesion · SoloInvitado · RequierePermiso
│   └── Inicio.tsx           "/" → primer módulo accesible
├── config/entorno.ts        Constantes y variables VITE_* (sin números mágicos en el código)
├── core/                    Infraestructura transversal, sin UI de negocio
│   ├── api/http.ts          ÚNICO cliente HTTP: Bearer, renovación ante 401, ErrorApi
│   ├── api/errores.ts       ErrorApi + mensajeDeError
│   ├── consultas.ts         TanStack Query: caché, reintentos, refresco
│   ├── sesion/              almacen (token en memoria) · autenticacion · useSesion ·
│   │                        useVigilanteSesion + decision (pura) · AvisoInactividad · permisos
│   ├── notificaciones/      Flashbar global: useNotificaciones().notificar(...)
│   └── preferencias/        Tema claro/oscuro/sistema y densidad
├── layout/                  Shell (AppLayout + SplitPanel), BarraSuperior, MenuLateral
├── modulos/
│   ├── registro.ts          Registro ÚNICO: rutas, menú, migas y permisos salen de aquí
│   ├── resumen/ auditoria/ monitoreo/ actividad/      (una página: XxxPagina.tsx)
│   └── usuarios/ roles/ permisos/                     (subpáginas: XxxModulo.tsx con <Routes>,
│                                                       paginas/ y acciones.tsx compartidas lista↔detalle)
├── compartido/
│   ├── marco/               Contrato página↔layout: useMarcoPagina (migas, tipo) y PanelDividido
│   ├── auditoria/           Etiquetas de la bitácora, su API de lectura e <Historial>
│   ├── datos/directorio.ts  Directorio de usuarios cacheado (filtros por persona, "creado por")
│   ├── componentes/         EstadoVacio, ModalConfirmacion, ModalCatalogo, Indicador, RequierePermiso…
│   └── util/                formato (fechas en zona del negocio), rangos, contraseña, navegador…
└── paginas/                 Login, Mi cuenta
```

### Capas de un módulo

| Archivo | Responsabilidad | Regla |
|---|---|---|
| `tipos.ts` | Contrato JSON del backend | Solo tipos |
| `api.ts` | URLs y verbos del módulo | Solo usa `http` de `core/api` (nunca `fetch`) |
| `consultas.ts` | Hooks de TanStack Query + claves de caché | Lectura con `useQuery`, cambios con `useMutation` + invalidación |
| `componentes/` | Presentación | Reciben datos por props; sin llamadas a la API |
| `acciones.tsx` | Acciones de un elemento (ítems del menú, confirmaciones, ejecución) | Iguales en lista y detalle |
| `XxxPagina.tsx` / `XxxModulo.tsx` | Compone consultas + componentes (o declara subrutas) | `export default` (se carga de forma diferida) |

Patrones de página (Cloudscape): tabla de página completa con filtros y preferencias; detalle con
`Container` + `KeyValuePairs` + `Tabs`; formulario de página completa (`Form`); detalle rápido en el
`SplitPanel` (`<PanelDividido>`); confirmaciones en `Modal` con motivo para la auditoría.

## Agregar un módulo (ejemplo con Auditoría)

1. Crear `src/modulos/auditoria/` con `tipos.ts`, `api.ts`, `consultas.ts`, `componentes/` y `AuditoriaPagina.tsx`.
2. Si hace falta, agregar el permiso a `core/sesion/permisos.ts`.
3. Registrar el módulo en `modulos/registro.ts`:
   ```ts
   {
     id: "auditoria",
     titulo: "Auditoría",
     descripcion: "Bitácora inmutable de accesos y cambios.",
     grupo: "supervision",
     permiso: PERMISOS.VER_AUDITORIA,
     tipoContenido: "table",
     pagina: lazy(() => import("./auditoria/AuditoriaPagina")),
   },
   ```
   La ruta `/auditoria/*`, la entrada del menú, las migas y la comprobación de permiso salen solas.
   Si tiene subpáginas, su componente raíz declara `<Routes>` y cada subpágina añade sus migas con
   `useMarcoPagina({ migas: [...] })`.
4. `npm run verificar`.

## Sesión

El access token vive solo en memoria y el refresh token en una cookie HttpOnly (`Path=/api/auth`).
Recargar o abrir otra pestaña no pide la contraseña; la sesión se renueva sola mientras haya
actividad y, tras 30 min sin actividad, pregunta "¿Sigues ahí?". Al cerrar sesión se borra la
caché de datos.

> En `localhost` las cookies no distinguen puertos: las dos consolas comparten la sesión del navegador.

## Fechas

La bitácora y el monitoreo llegan con zona (`…Z`); las fechas de altas y cambios (`creadoEn`,
`actualizadoEn`) llegan sin zona en la hora del backend (`APP_ZONA_HORARIA`, por defecto
`America/Lima`). `VITE_ZONA_NEGOCIO` debe coincidir con ella. Todo se muestra en la zona del navegador.

## Reglas de diseño (Cloudscape)

- Solo componentes de `@cloudscape-design/components`; nada de HTML nativo para controles ni otra librería de UI.
- Sin colores, fuentes ni px literales: espaciado con `SpaceBetween`/`Box`, color con props, CSS solo con tokens (`src/estilos.css`).
- Cada vista de datos con estados de carga, vacío, sin coincidencias y error.
- Textos en español (I18nProvider) y en *sentence case*; botones con verbo + objeto.
