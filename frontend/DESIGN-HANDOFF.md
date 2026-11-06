# Handoff de diseño — Rediseño "consola plana"

Especificación de implementación del rediseño visual y estructural del frontend (Angular 22) con el sistema de diseño **consola plana**. Es un cambio de presentación: plantillas, SCSS, layout y componentes compartidos. **No cambia** el contrato HTTP (URLs, cuerpos JSON, sobre `ApiResponse`), ni la lógica de servicios, guards, interceptores o el registro de paneles/permisos.

- Fuente de verdad del sistema: `src/styles/` (tokens, temas, mixins y base del skill) y `src/app/shared/ui/` (componentes portados).
- En SCSS de componentes: `@use 'design' as d;`. Todo valor sale de una función o mixin del sistema; un token inexistente rompe el build.
- Notación de tokens en este documento:
  - Color: `color(rol)` → `d.color('rol')` → `var(--color-rol)`.
  - Espacio: `space(n)` → `d.space('n')` (`'1'`=4 px … `'12'`=48 px).
  - Tipografía: `type(estilo)` → `@include d.type('estilo')`.
  - Medidas de layout: `layout(clave)` → `d.layout('clave')` (`topbar-height`, `sidebar-width`, `control-height`, `control-height-sm`, `nav-item-height`, `menu-item-height`, `row-height`, `badge-height`, `content-max`).
  - Radio, sombra, capa, movimiento: `radius()`, `shadow()`, `z()`, `motion()`.
  - Breakpoints: `bp(sm|md|lg|xl|2xl)` = 480 / 768 / 1024 / 1280 / 1536 px (mobile‑first).

---

## 0. Reglas transversales (aplican a todas las pantallas)

| Regla | Implementación |
|---|---|
| Esquinas rectas | `radius('md')` y `radius('lg')` valen 0. Solo avatar, interruptor y pista de progreso usan `radius('full')`; `kbd` y tooltips, `radius('sm')`. |
| Bordes, no sombras | Superficies con `1px solid color(border)`; tarjetas e inputs con `color(border-strong)`. `shadow('menu')` solo en menús CDK; `shadow('lg')` solo en modales y la paleta ⌘K. |
| Monocromo + un acento | Grises neutros; `color(accent)` solo en enlaces, ítem activo, selección, foco de pestaña y botones `tertiary`. |
| Una acción principal por vista | `appButton` (variant `primary`, negro → `color(primary-hover)` violeta). El resto `secondary` / `ghost` / `tertiary`; destructivas `danger`. |
| Tres voces tipográficas | Títulos `type(heading-06/05/04/03)` (Geist), texto `type(body-02/01)`, etiquetas `type(mono-01-caps)` / `type(mono-00-caps)` (Geist Mono). |
| Estados con badge | `<app-badge tone="success|warning|danger|accent|neutral">`, nunca colores sueltos. |
| Aire | Contenido con `space(8)` arriba y `space(12)` (48 px) laterales en ≥`bp(lg)`; `space(6)` en tablet y `space(4)` en móvil. Secciones separadas por `space(8)`. |
| Íconos | `ui-icon` lineal de 16–20 px en `color(text-faint)`; toman `color(accent)` solo en el ítem activo. |
| Grids seguros | Toda página/sección en grid usa `grid-template-columns: minmax(0, 1fr)`. |
| Foco | Anillo `2px solid color(focus)` (azul) vía `@include d.focus-ring`. Nunca se elimina sin reemplazo. |
| Temas | Claro por defecto; oscuro con `[data-theme='dark']` (lo escribe `TemaService`) o `prefers-color-scheme`. Todos los roles existen en ambos temas. |
| Movimiento | `motion('fast')` = 200 ms, `motion('easing')` = ease-out; animaciones envueltas en `@include d.motion-safe`; `prefers-reduced-motion` las anula en la base. |

### Componentes compartidos (inventario)

| Componente | Selector | Origen | Uso |
|---|---|---|---|
| Botón | `button[appButton]`, `a[appButton]` | skill | `variant`: primary · secondary · tertiary · ghost · danger; `size`: md (40 px) · sm (32 px). Soporta `aria-disabled` además de `disabled`. |
| Badge | `app-badge` | skill | `tone`, `size` sm (24 px) / md (28 px). |
| Encabezado de página | `app-page-header` | skill | `eyebrow`, `heading`, `kind` overview/detail; slots `[pageMeta]`, `[pageActions]`. |
| Aviso | `app-notice` | skill | `tone` accent/success/warning/danger; `dismissible`. |
| Menú | `[appMenu]`, `[appMenuItem]`, `app-menu-separator` | skill (CDK Menu) | Menús ⋯ por fila, cuenta, conmutador de panel. |
| Búsqueda | `app-search-field` | skill | `label` obligatorio (oculto), `[value]` + `(valueChange)`. |
| Segmentado | `app-segmented` | skill | Filtros excluyentes (radiogroup). |
| Pestañas de ruta | `app-tabs` | skill | Disponible; el detalle de usuario usa pestañas en página (`.ui-tabs`) con el mismo estilo. |
| Interruptor | `app-toggle` | skill | Disponible; los `role="switch"` existentes (`.switch`) adoptan sus medidas. |
| Avatar | `app-avatar` | skill | Iniciales, `size` sm 20 / md 28 / lg 36. |
| Migas | `app-breadcrumbs` | adaptado | Recibe `[items]` derivados del registro de paneles (no de `data.breadcrumb`, porque las rutas se generan desde `registro.ts`). |
| Modal | `ui-modal` | existente, restilizado | Trampa de foco propia; panel `surface`, borde `border`, `shadow('lg')`, fondo `color(overlay)`. Variante `lateral` = panel de detalle a la derecha. |
| Confirmación | `ui-confirmacion` | existente, restilizado | Sobre `ui-modal` con `role="alertdialog"`. |
| Paginador | `ui-paginador` | existente, restilizado | Botones cuadrados 32 px, activo `primary-soft` + `accent`. |
| Estado vacío | `ui-empty` | existente, restilizado | Patrón `d.page-empty` (alineado a la izquierda). |
| Toasts | `ui-toast-host` | existente, restilizado | Panel plano con borde y franja de tono a la izquierda. |
| Loader global | `ui-loader` | existente, restilizado | Velo `color(overlay)` + barra de progreso indeterminada de 2 px. |
| Gráficos | `ui-bars`, `ui-barras-h` | existentes, restilizados | Barras planas en `color(chart-2)`; ejes `type(mono-00)`; rejilla `color(chart-grid)`. |

---

## 1. Login

### Overview
Única pantalla pública. Autentica con usuario/correo + contraseña. Debe sentirse sobria y confiable; sin WebGL, sin degradados ni ilustraciones.

### Layout
- `bp(lg)`+: dos columnas `minmax(0, 1fr) minmax(0, 1fr)`. Izquierda: formulario centrado verticalmente, ancho máximo 400 px. Derecha: panel informativo en `color(surface-muted)` con línea izquierda `border`.
- `< bp(lg)`: una columna; el panel informativo se oculta.
- En el DOM el formulario va primero (orden de lectura y tabulación).

### Tokens
| Token | Uso |
|---|---|
| `color(bg)` | Fondo de la columna del formulario |
| `color(surface-muted)`, `color(border)` | Panel informativo |
| `type(mono-01-caps)` + `color(text-faint)` (`d.eyebrow`) | Marca "HEHIACHI MISHIMA" y "CONTROL DE ACCESOS" |
| `type(heading-05)` → `type(heading-06)` en `bp(md)` | `h1` "Iniciar sesión" |
| `type(body-02)` + `color(text-muted)` | Texto de apoyo |
| `type(body-02-semi-bold)` | Labels |
| `layout(control-height)` | Inputs y botón |
| `d.kv-list` | Lista de características del panel derecho |

### Componentes
| Componente | Variante | Notas |
|---|---|---|
| `app-notice` | `danger` | Error de autenticación (`role="alert"`, id `login-error`). |
| `input` nativo | base | Ícono 16 px a la izquierda (`text-faint`), botón de ojo cuadrado 40 px a la derecha. |
| `appButton` | primary, ancho completo | "Ingresar"; con spinner y texto "Verificando…" al cargar. |

### Estados e interacciones
| Elemento | Estado | Comportamiento |
|---|---|---|
| Input | Hover | Borde `color(text-faint)` |
| Input | Foco | Anillo `color(focus)` 2 px |
| Input | Inválido (tocado) | `aria-invalid="true"` → borde `color(danger)`; mensaje `type(helper-text-01)` en `color(danger)` debajo |
| Botón Ingresar | Hover | `color(primary-hover)` |
| Botón Ingresar | Cargando | `aria-disabled`, spinner, no reenvía |
| Mostrar contraseña | Pulsado | `aria-pressed="true"`, ícono `eyeOff` |

### Responsive
| Ancho | Cambios |
|---|---|
| 360 | Una columna, relleno `space(4)`; `h1` 28 px |
| 768 | Una columna, formulario centrado, `h1` 32 px |
| 1440 | Dos columnas; panel informativo visible |

### Edge cases
- **Error de red / 401**: `app-notice tone="danger"` con el mensaje de `mensajeDeError`.
- **Usuario largo**: el input hace scroll interno; nada se desborda.
- **returnUrl**: sin cambios de lógica.

### Motion
Ninguna animación propia; solo transiciones de color de 200 ms en controles.

### Accesibilidad
- Foco inicial en "Usuario" (`autofocus`).
- `aria-describedby` del botón apunta a `login-error` cuando existe.
- Nota de auditoría con ícono de candado, texto `body-01` `text-muted`.

---

## 2. Portal (selector de paneles y acceso denegado global)

### Overview
Marco de las vistas fuera de un panel: `/paneles` y `/sin-acceso`. Permite entrar a cada panel accesible o saltar a sus módulos.

### Layout
- **Barra superior** de `layout(topbar-height)` en celdas (igual que el shell, sin migas): marca · espacio · tema · cuenta.
- **Contenido**: máximo `layout(content-max)`, relleno `space(8)` × `space(12)` en `bp(lg)`.
- **Encabezado**: `app-page-header` eyebrow "Portal · {fecha}", heading "{saludo}, {nombre}", meta "N paneles · M módulos".
- **Rejilla de paneles**: `repeat(auto-fill, minmax(min(100%, 22rem), 1fr))`, gap `space(6)`.
- **Tarjeta de panel** (`d.entity-card(true)`): eyebrow "PANEL", `h3` nombre, descripción `body-01` `text-muted`, lista de módulos (filas de 36 px con ícono 16 px y chevron), y un `appButton` secundario `sm` "Entrar al panel".

### Tokens
`color(border-strong)` (tarjeta), `color(accent)` (borde en hover), `d.eyebrow`, `type(heading-03)`, `type(interface-01)` (filas de módulo), `color(surface-hover)` (hover de fila).

### Estados
| Elemento | Estado | Comportamiento |
|---|---|---|
| Tarjeta | Hover | Borde `color(accent)` |
| Fila de módulo | Hover / foco | Fondo `color(surface-hover)`, texto `text-strong` |

### Responsive
| Ancho | Cambios |
|---|---|
| 360 | Una tarjeta por fila; relleno `space(4)` |
| 768 | 1–2 tarjetas |
| 1440 | 3 o más |

### Edge cases
- **Ningún panel**: el router ya redirige a `/sin-acceso`.
- **Descripción larga**: `line-clamp(2)` en la tarjeta.

### Acceso denegado (`app-sin-acceso`)
- Patrón `d.page-empty`: `h1` con `type(heading-05)`, texto `body-02` `text-muted`, permiso en `<code>`, y acciones: `appButton primary` "Ir a {destino}" + `appButton ghost` "Cerrar sesión".
- Va dentro del shell o del portal; alineado a la izquierda, ancho máximo 500 px.

### Accesibilidad
`h1` con `tabindex="-1"` para recibir foco tras navegar; tarjetas como `article` con `aria-labelledby`.

---

## 3. Shell del panel (`panel-shell`)

### Overview
Estructura autenticada de un panel: barra superior en celdas, menú lateral gris por grupos y contenido. Mantiene: grupos y módulos filtrados por permisos (`modulosAccesibles`), conmutador de panel, paleta ⌘K, inert en drawer, foco al `h1` tras navegar, Escape.

### Layout
```
┌──────────── topbar (layout(topbar-height)) ─────────────────────────────┐
│[☰]│ Marca/panel ▾ (sidebar-width) │ Migas ……… │ Buscar ⌘K │ ☾ │ Cuenta ▾│
├──────────────────────────────┬──────────────────────────────────────────┤
│ Menú lateral surface-muted   │ main#contenido                            │
│  SUPERVISIÓN                 │  app-page-header                          │
│   ▪ Resumen                  │  …                                        │
│   ▪ Auditoría                │                                           │
│  GESTIÓN                     │                                           │
│   ▪ Usuarios  ▪ Roles …      │                                           │
└──────────────────────────────┴──────────────────────────────────────────┘
```
- `bp(lg)`+: `grid-template-columns: layout(sidebar-width) minmax(0, 1fr)`; menú `sticky` bajo la barra con su propio scroll.
- `< bp(lg)`: menú como drawer fijo `min(sidebar-width, 85vw)` desde la izquierda, velo `color(overlay)`; aparece la celda ☰.

### Tokens
| Token | Uso |
|---|---|
| `color(surface)` + borde inferior `color(border)` | Barra superior |
| Separadores verticales `color(border)` | Entre celdas |
| `color(surface-hover)` | Hover y `aria-expanded` de celdas |
| `type(interface-00)` | Texto de celdas |
| `color(surface-muted)` + borde derecho `color(border)` | Menú lateral |
| `d.eyebrow` | Etiqueta de grupo ("SUPERVISIÓN", "GESTIÓN") |
| `type(interface-02)`, `layout(nav-item-height)` | Ítem del menú |
| `color(primary-soft)` + `color(accent)` | Ítem activo (texto e ícono) |
| `type(body-01)` + `color(text-muted)` | Migas; actual en `color(text)` |
| `color(border-strong)` | Separador chevron de las migas |
| `d.kbd` | Atajo "⌘K" / "Ctrl K" |

### Componentes
| Componente | Notas |
|---|---|
| Celda de marca | Botón con cuadro de 24 px (borde `border-strong`, ícono del panel), eyebrow "PANEL" y nombre; abre un `appMenu` CDK con los paneles accesibles (el actual `selected`) y "Todos los paneles". |
| `app-breadcrumbs` | Paneles › {Panel} › {Módulo}; el último con `aria-current="page"`. |
| Celda de búsqueda | Ícono + "Ir a un módulo…" + `kbd`; abre `app-paleta-modulos`. Solo ícono en móvil. |
| Celda de tema | Botón cuadrado de 56 px, ícono sol/luna, `aria-label` dinámico. |
| `app-menu-cuenta` | Celda con `app-avatar` 20 px, nombre (oculto < `bp(md)`), `chevron-down`; menú CDK con cabecera (nombre + correo `body-00` `text-muted`), "Cambiar contraseña", separador, "Cerrar sesión" (`tone="danger"`). |
| Paleta ⌘K | `<dialog>` nativo: panel `surface`, borde `border`, `shadow('lg')`, sin radio; input de 56 px; grupos en `d.eyebrow`; opción activa `primary-soft` + `accent`. |

### Estados e interacciones
| Elemento | Estado | Comportamiento |
|---|---|---|
| Ítem de menú | Hover | `color(surface-hover)`, texto `text-strong` |
| Ítem de menú | Activo | `routerLinkActive` → `primary-soft` / `accent`, `aria-current="page"` |
| Drawer | Abierto | `transform: none`; contenido `inert`; Escape cierra y devuelve el foco a ☰ |
| Drawer | Navegar | Se cierra |
| ⌘K / Ctrl K | Pulsar | Abre/cierra la paleta salvo si hay un `.ui-modal` abierto |
| Menús CDK | Teclado | Flechas, Esc, Tab y clic fuera resueltos por CDK |

### Responsive
| Ancho | Cambios |
|---|---|
| 360 | Celda ☰ + marca compacta (sin eyebrow); migas ocultas; búsqueda solo ícono; nombre de cuenta oculto; contenido `space(4)` |
| 768 | Migas visibles; nombre de cuenta visible; drawer; contenido `space(6)` |
| 1440 | Menú fijo de `layout(sidebar-width)`; la celda de marca mide lo mismo y su línea continúa la del menú; contenido `space(12)` laterales |

### Edge cases
- **Barra compacta (solo íconos)**: se retira; el estilo consola usa un menú lateral fijo de `layout(sidebar-width)`.
- **Grupo sin módulos permitidos**: desaparece con su etiqueta.
- **Nombre de panel / módulo largo**: `d.truncate` en marca, migas e ítems.
- **Un solo panel**: el menú del conmutador muestra igualmente "Todos los paneles".

### Motion
| Elemento | Disparador | Animación | Duración | Easing |
|---|---|---|---|---|
| Drawer | Abrir/cerrar | `translateX(-100%)` → 0 | `motion('normal')` | `motion('easing')` |
| Celdas / ítems | Hover | Color de fondo | `motion('fast')` | `motion('easing')` |
| Cambio de tema | Clic | Fundido por defecto de View Transitions (`TemaService`, sin cambios); se eliminó el círculo de revelado | navegador | — |

### Accesibilidad
- Enlace "Saltar al contenido principal" (primer foco), visible al enfocar.
- `nav aria-label="Módulos"`; cada `ul` con `aria-labelledby` a su etiqueta de grupo.
- `main#contenido tabindex="-1"`; tras cada navegación el foco va al `h1`.
- Botón ☰ con `aria-expanded` y `aria-controls="shell-nav"`.

---

## 4. Resumen (dashboard)

### Overview
Estado del control de accesos: indicadores, lo que requiere atención, seguridad (bitácora), distribución en gráficos y accesos rápidos.

### Layout (de arriba abajo, separadas `space(8)`)
1. `app-page-header` — eyebrow "{fecha}", heading "{saludo}, {nombre}", meta "Actualizado hace …" (`role="status"`), acción `appButton secondary sm` "Actualizar".
2. **Identidades y accesos** (`h2`): rejilla de métricas `repeat(auto-fill, minmax(min(100%, 13rem), 1fr))` con **borde compartido** (celdas `d.panel(space(6))` con `margin: -1px 0 0 -1px`). Cada métrica: eyebrow con ícono 16 px, cifra `type(heading-05)` con `tabular-nums`, detalle `body-01` `text-muted`, enlace `tertiary` opcional. El tono se expresa con un `app-badge` pequeño ("Revisar", "OK"), no coloreando la tarjeta.
3. Fila de dos columnas en `bp(xl)` (`minmax(0, 3fr) minmax(0, 2fr)`), una en menos:
   - **Requiere atención**: lista `d.timeline` (ítems con borde compartido); ícono de estado a la izquierda en el color del tono (`warning`, `danger`, `accent`, `success`) y enlace "Revisar" a la derecha.
   - **Seguridad**: tres métricas de la bitácora con el mismo patrón; badge `danger` si el valor > 0.
4. **Distribución del acceso**: rejilla `repeat(auto-fit, minmax(min(100%, 26rem), 1fr))` de paneles `d.panel` con `h3` + descripción y `d.chart-frame`.
5. **Accesos rápidos**: `d.entity-card(true)` por módulo (ícono, nombre `heading-02`, descripción `body-01`).

### Tokens
`d.panel`, `d.eyebrow`, `type(heading-05)`, `type(mono-00)` (ejes y valores de gráficos), `color(chart-2)` (barras), `color(chart-grid)`, `color(progress-track)` (pista de barras horizontales), `color(neutral-soft)` (barras apagadas), `color(skeleton)`.

### Estados
| Elemento | Estado | Comportamiento |
|---|---|---|
| Métricas | Cargando | Celdas con barra `color(skeleton)` pulsante y texto sr-only |
| Métricas | Error sin datos | `app-notice tone="danger"` con "Reintentar" (`secondary sm`) |
| Métrica de bitácora | Cargando | Skeleton; `NaN` → "No disponible" |
| Atención | Nada pendiente | Ítem con `circle-check` en `success`: "Nada pendiente por ahora." |
| Barra | Hover | Fondo `color(accent)` |

### Responsive
| Ancho | Cambios |
|---|---|
| 360 | Métricas 1–2 por fila; atención y seguridad apiladas; barras horizontales en dos filas (etiqueta+valor / pista) |
| 768 | Métricas 3 por fila; gráficos uno por fila |
| 1440 | 5 métricas en fila; atención + seguridad lado a lado; gráficos en 2–3 columnas |

### Edge cases
- **Sin roles / permisos / altas**: párrafo `body-01` `text-muted` dentro del panel del gráfico.
- **Etiquetas largas de permisos**: `overflow-wrap: anywhere` en la etiqueta; el código va en `type(mono-00)` debajo.
- **Cifras grandes**: `formatearNumero`, `tabular-nums`.

### Motion
| Elemento | Disparador | Animación | Duración | Easing |
|---|---|---|---|---|
| Barras | Render | `scaleY`/`scaleX` 0 → 1 | 600 ms | `motion('easing')` (solo con `motion-safe`) |

### Accesibilidad
Las barras son listas semánticas ("Etiqueta: valor"); cada sección con `aria-labelledby` a su `h2`; `aria-busy` mientras carga.

---

## 5. Usuarios (+ roles del usuario, permisos individuales, restablecer contraseña)

### Overview
Listado filtrable y paginado de cuentas con detalle lateral, alta/edición, activación, eliminación y gestión de accesos.

### Layout
1. `app-page-header` — eyebrow "Panel Administración", heading "Usuarios", meta con la descripción, acción `appButton primary` "Nuevo usuario" (con `*hasPermiso`).
2. **Barra de herramientas**: `display:flex; flex-wrap:wrap; gap: space(3) space(6)` — `app-search-field` (máx. 384 px), filtros (`select` de estado y rol, chip "Sin rol") y, a la derecha, `appButton secondary sm` "Actualizar". En móvil los filtros se pliegan tras "Filtros (n)".
3. **Resumen de filtros**: `body-01` `text-muted` con `tertiary` "Limpiar filtros".
4. **Tabla sin tarjeta** (ver §5.1).
5. `ui-paginador` debajo, separado por línea `border`.

### 5.1 Tabla (patrón común a Usuarios, Roles, Permisos y Auditoría)
| Aspecto | Especificación |
|---|---|
| Contenedor | Sin borde ni fondo propio; vive sobre la página |
| Cabecera | `type(mono-00-caps)`, color `text`, alto 40 px, línea inferior `border-strong`, `position: sticky` bajo la barra superior |
| Fila | `layout(row-height)` mínimo, línea inferior `border`, hover `color(surface-muted)` |
| Celda | `type(body-01)`, `tabular-nums`; secundaria en `text-muted` |
| Primera columna | `app-avatar` md + nombre como enlace subrayado (`text-strong`, subrayado `border-strong` → `accent` en hover); debajo `@usuario · correo` truncado |
| Estado | `app-badge` success "Activo" / neutral "Inactivo"; neutral con candado "Protegido"; accent "Tú" |
| Roles | Hasta 2 `app-badge tone="accent"` + `app-badge` "+N"; warning "Sin rol" |
| Acciones | **Un solo botón ⋯** (`ui-icon-btn`, 32 px) que abre un `appMenu`: Ver detalle · Roles · Editar · Activar/Desactivar · Restablecer contraseña · separador · Eliminar (`tone="danger"`). Ítems no aplicables → `disabled`; si la fila está protegida, la primera línea del menú es una nota `body-00` `text-muted` con el motivo. |
| Columnas redimensionables | Se mantiene `appColumnasRedimensionables` en escritorio; asa de 6 px que se ve en hover (`color(border-strong)`) y en foco (`color(focus)`) |
| Fila seleccionada | La del detalle abierto: fondo `color(primary-soft)` |

### 5.2 Detalle lateral (`ui-modal lateral`)
- Ancho `min(36rem, 100vw)`, alto completo, borde izquierdo `border`, `shadow('lg')`.
- Cabecera: `h2` `type(heading-04)` + subtítulo `body-01` `text-muted`; botón cerrar cuadrado.
- Pestañas en página (`.ui-tabs`, `role="tablist"`): texto `interface-01` `text-muted`; activa `text-strong` con línea `accent` de 2 px.
- **Resumen**: `d.kv-list`. Si está protegido: `app-notice tone="warning"` con el motivo.
- **Accesos**: `h3` `type(heading-02)`, roles como badges accent, permisos como lista de `<code>`; acciones `secondary sm`.
- **Historial**: `ui-historial` (línea de tiempo `d.timeline`, segmentado "Sobre este registro | Acciones realizadas").
- Pie: `secondary sm` Editar / Restablecer contraseña y `danger sm` Eliminar, alineados a la izquierda.

### 5.3 Formularios (alta/edición, restablecer, cambiar contraseña)
- `ui-modal` `ancho="lg"`; rejilla `.grid-form` de 2 columnas en `bp(md)`, 1 en móvil, gap `space(4)` `space(6)`.
- Campo: label `type(body-02-semi-bold)` (14 px en modales: `body-01-semi-bold`), input 40 px, ayuda `helper-text-01` `text-muted`, error `helper-text-01` `danger`. Obligatorio con `*` en `danger` (`aria-hidden`).
- Requisitos de contraseña: lista con ícono check/x y texto (no solo color); cumplido en `success`.
- Checkbox nativo con `accent-color: color(accent)`, 16 px, área táctil 44 px en `touch`.
- Pie: `ghost` "Cancelar" + `primary` "Crear usuario"/"Guardar cambios" (restablecer: `danger`).

### 5.4 Roles del usuario / Permisos individuales
- Lista con borde compartido (filas 56 px, `border`), nombre `body-01-medium`, descripción `body-00` `text-muted`; a la derecha el interruptor (medidas de `app-toggle`: pista 36×20, `toggle-on` verde).
- Permisos individuales: `app-search-field`, `app-segmented` (Todos / Con ajuste / Permitidos / Bloqueados), resumen con badges (accent permitidos, success concedidos, danger denegados), y por fila un segmentado de 3 opciones (Heredar · Conceder · Denegar) con el seleccionado en `primary-soft`/`accent` (Conceder en `success-soft`/`success`, Denegar en `danger-soft`/`danger`).
- Bloqueo: `app-notice tone="warning"`.

### Estados
| Elemento | Estado | Comportamiento |
|---|---|---|
| Lista | Cargando | 5 barras skeleton de 12 px en filas de 48 px |
| Lista | Error | `ui-empty` con "Reintentar" (`secondary sm`) |
| Lista | Vacía / sin resultados | `ui-empty` con "Nuevo usuario" (`secondary` + `plus`) o "Limpiar filtros" |
| Interruptor | Cambiando | `aria-busy`, opacidad 0.5 |
| Guardar | Enviando | Spinner + `aria-disabled` |

### Responsive
| Ancho | Cambios |
|---|---|
| 360 | Tabla → tarjetas: primera línea nombre (`body-02-medium`) + ⋯; debajo clave (`mono-00-caps` `text-faint`) / valor; filtros plegados; modales a pantalla completa desde abajo |
| 768 | Tabla completa (columnas `col-p3` ocultas hasta `bp(lg)`); detalle lateral de 36 rem |
| 1440 | Todas las columnas; redimensionables |

### Edge cases
- **Nombre/correo largo**: `d.truncate` con `title` completo.
- **Muchos roles**: 2 visibles + "+N" con lista sr-only.
- **Resumen de accesos no disponible**: "No disponible" `text-muted` con `title`.
- **Usuario protegido o propio**: menú ⋯ con ítems deshabilitados y motivo visible.

### Accesibilidad
`aria-label` en la tabla; el ⋯ lleva `aria-label="Acciones de @usuario"`; el foco vuelve al disparador al cerrar menús y modales (CDK / `ui-modal`); `role="status"` en el resumen de filtros.

---

## 6. Roles

Igual estructura que Usuarios (§5, §5.1).
- Encabezado: heading "Roles", acción primary "Nuevo rol".
- Columnas: Rol (nombre como texto fuerte + descripción `text-muted`), Estado (badges), Usuarios (número a la derecha o "Sin usuarios" `text-muted`), Último cambio (relativa + "por actor"), ⋯.
- Menú ⋯: Historial · Permisos del rol · Editar · Activar/Desactivar · separador · Eliminar (danger). Protegido → ítems de edición deshabilitados + nota.
- Modal "Permisos del rol": `app-notice` (accent) con el impacto ("se aplica a N usuarios"); lista con interruptores.
- Historial: `ui-modal lateral` con `ui-historial`.
- Edge: descripción larga → `line-clamp(2)` en tabla, completa en `title`.

## 7. Permisos

Igual estructura (§5.1).
- Encabezado: heading "Permisos", meta "Catálogo del sistema. Los permisos base están protegidos.", acción primary "Nuevo permiso".
- Columnas: Permiso (descripción + código en `<code>` `type(mono-01)`), Estado, Último cambio, ⋯ (Roles con este permiso · Editar · Activar/Desactivar · Eliminar).
- Formulario: el campo Código usa `type(mono-01)` y ayuda "En mayúsculas y con guiones bajos".
- Modal "Roles con este permiso": lista de solo lectura con borde compartido.

## 8. Auditoría

### Overview
Bitácora inmutable, filtrable por periodo, acción, entidad, actor, texto y resultado; agrupada por día; exportable a CSV.

### Layout
1. `app-page-header` — heading "Auditoría", meta descripción, acción `appButton secondary` "Exportar CSV" (ícono download). Debajo, `app-notice` (accent) "Registro de solo lectura…".
2. **Filtros**: rejilla `repeat(auto-fill, minmax(min(100%, 12rem), 1fr))` gap `space(4)`, labels `type(mono-00-caps)` `text-faint` (filtros compactos); Resultado como chips con `aria-pressed` (borde `border`, activo `primary-soft`/`accent`). En móvil se pliegan tras "Filtros".
3. **Barra de resultado**: total en `body-01-semi-bold`, chips de filtros activos (`app-badge tone="accent"` con ✕), "Limpiar filtros" y "Vistas:" con botones `tertiary sm`.
4. **Tabla** (§5.1) con fila de grupo por día: `th` `type(mono-00-caps)` `text-muted`, fondo `color(surface-muted)`, sticky bajo la cabecera. Hora e IP en `type(mono-01)`. Resultado como badge con ícono. Acción como enlace subrayado (abre el detalle). Fila denegada: borde izquierdo de 2 px `color(danger)`.
5. `ui-paginador`.

### Detalle lateral
`d.kv-list` (Actor, Objetivo, IP, Cliente, Petición con `<code>` + botón copiar `ui-icon-btn`), tabla Antes/Después (filas cambiadas en `body-01-semi-bold`), `<details>` "Detalle técnico" con `<pre>` `d.code-block`. Pie con `secondary sm`.

### Estados / edge cases
- Total topado: nota `text-muted` "(se muestran como máximo N; acota el periodo)".
- Sin resultados con filtros: `ui-empty` con "Ampliar a 30 días" (`secondary sm`) y "Limpiar filtros" (`ghost sm`).
- Error: `ui-empty` + id de correlación en `<code>`.
- Objetivo largo: `d.truncate` + `title`.
- Navegación por teclado entre filas (`moverFoco`) se conserva.

### Responsive
360: tarjetas; la fila de día se vuelve un separador eyebrow sticky. 768: tabla sin IP. 1440: completa.

---

## 9. Modales, cuenta, toasts, aviso de sesión, loader, paginador, vacío

### Modal (`ui-modal`)
| Aspecto | Especificación |
|---|---|
| Fondo | `color(overlay)` fijo, `z('overlay')`+ |
| Panel | `color(surface)`, borde `border`, `shadow('lg')`, sin radio; anchos sm 28 rem / md 36 rem / lg 48 rem |
| Cabecera | relleno `space(6)`; `h2` `type(heading-03)`; subtítulo `body-01` `text-muted`; cerrar `ui-icon-btn` |
| Cuerpo | relleno `0 space(6) space(6)`, scroll propio |
| Pie | línea superior `border`, relleno `space(4) space(6)`, acciones a la derecha (lateral: izquierda) |
| Móvil (< `bp(md)`) | Hoja desde abajo a ancho completo, alto máx. 92dvh; lateral a pantalla completa; botones del pie al 100 % |
| Motion | Entrada `opacity` + `translateY(8px)` → 0, `motion('normal')`, `motion-safe` |
| A11y | `role="dialog"`/`alertdialog`, `aria-modal`, `aria-labelledby`/`describedby`, trampa de foco, Escape, retorno de foco |

### Confirmación (`ui-confirmacion`)
Ícono 20 px en cuadro de 40 px con fondo `danger-soft`/`danger` (o `primary-soft`/`accent` si no es peligrosa); pregunta `body-02-semi-bold`; descripción `body-01` `text-muted`; motivo opcional en `textarea`. Foco inicial en "Cancelar" (`ghost`); confirmar `danger` o `primary`.

### Cuenta
Ver §3 (`app-menu-cuenta` + menú CDK). "Cambiar contraseña" abre `app-cambiar-contrasena` (§5.3).

### Aviso de sesión (`app-aviso-sesion`)
`ui-modal` sm `alertdialog`: texto `body-02` con la hora en `body-02-semi-bold`; `ghost` "Cerrar sesión ahora" + `primary` "Entendido" (foco inicial).

### Toasts (`ui-toast-host`)
- Pila fija abajo a la derecha (`space(6)`), ancho `min(24rem, 100vw - space(8))`, `z('toast')`; en móvil abajo a ancho completo con `space(4)`.
- Toast: `color(surface)`, borde `border`, franja izquierda de 3 px del tono (`success`, `danger`, `warning`, `accent` para info), `shadow('menu')` (flota). Título `body-01-semi-bold`, texto `body-01` `text-muted`, acción `tertiary`, cerrar `ui-icon-btn`.
- Motion: entra con `translateY(8px)` + opacidad, `motion('normal')`.
- Hover/foco pausa el cierre (sin cambios de lógica).

### Loader global (`ui-loader`)
Velo `color(overlay)` suave; caja `surface` con borde `border` y barra indeterminada de 2 px (`progress-fill` sobre `progress-track`) + texto `body-01`. Sin blur.

### Paginador (`ui-paginador`)
Fila `flex-wrap` con línea superior `border` y relleno `space(3) 0`: "Mostrando 1–10 de 57" (`body-01` `text-muted`, cifras `text-strong`), "Filas por página" + `select` compacto de 32 px, navegación con botones cuadrados de 32 px (borde `border`, activa `primary-soft` + borde `accent`). `aria-disabled` en extremos con opacidad 0.4.

### Estado vacío (`ui-empty`)
`d.page-empty` a la izquierda: ícono 20 px en `text-faint`, `h3` `type(heading-03)`, texto `body-02` `text-muted`, acciones 32 px debajo (`space(8)`).

### Paleta ⌘K
Ver §3.

---

## 10. Archivos y migración

| Acción | Archivo(s) |
|---|---|
| Reemplazar | `src/styles/` → sistema del skill (`_design.scss`, `main.scss`, `tokens/`, `themes/`, `mixins/`, `base/`) + `components/_ui.scss` (vocabulario global `ui-*`, `grid-form`, `check`, `switch`, tablas, modales, toasts…) |
| Agregar | `src/app/shared/ui/{button,badge,page-header,notice,menu,tabs,search-field,toggle,avatar,segmented,breadcrumbs}` |
| Reescribir | `layout/panel-shell.*`, `layout/portal/*`, `layout/sin-acceso`, `features/auth/login/*`, `features/cuenta/menu-cuenta.ts`, plantillas de los módulos |
| Eliminar | `shared/ui/light-pillar/`, `public/fonts/` (Inter, Plus Jakarta, JetBrains Mono), `public/img_fondo.jpg`, `public/logo_hacker.png` (sin uso) |
| Sin cambios | `core/**` (servicios, modelos, guards, interceptores), `paneles/registro.ts`, `app.routes.ts`, directiva `has-permiso` |
