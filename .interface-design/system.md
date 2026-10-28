# Hehiachi Mishima — sistema de interfaz

## Dirección

Portal profesional de administración de identidades y accesos: moderno, claro y con más energía que el monocromo Apple original. El color comunica función, no decoración. La estructura de paneles, módulos y navegación se conserva; el login y su elemento audiovisual quedan fuera de este sistema visual.

## Dominio y firma

- **Dominio:** identidades, roles, permisos, confianza, actividad y control de acceso.
- **Paleta de contexto:** azul de acceso confiable, violeta de identidad/permisos, verde de permitido, ámbar de atención, rojo de denegado y grafito para superficies.
- **Firma:** un «rastro de acceso»: acento azul persistente en acciones principales y navegación activa, con acentos funcionales para datos y estados.
- No asignar colores al azar por tarjeta o módulo. Los elementos con la misma función deben conservar color y tratamiento en todas las pantallas.

## Paleta funcional

Los valores se definen en `frontend/src/styles/_components.scss`, dentro de `.launcher`, `.shell` y `.denied`. No cambiar los tokens raíz compartidos con el login.

| Función | Claro | Oscuro |
|---|---|---|
| Acción principal / navegación activa | `--brand: #3156e8`; texto `#fff` | `--brand: #3156e8`; texto `#fff`; superficie activa azul grafito |
| Identidad y permisos | `--info: #7141ce` | `--info: #b49aff` |
| Permitido / activo | `--success: #087c54` | `--success: #5ae0a6` |
| Atención | `--warning: #8a4f08` | `--warning: #ffd078` |
| Denegado / destructivo | `--danger: #c0394c` | `--danger: #ff8293`; texto sobre botón `#2a1017` |
| Campo de filtro/búsqueda | fondo `#f5f7ff`; borde `#c9d4e6` | fondo `#202a43`; borde `#435371` |
| Canvas | `#f4f7fd` | `#111827` |
| Superficie | `#fff` | `#181f31` |
| Superficie secundaria | `#f2f5fc` | `#1f2940` |

Conservar los tokens semánticos (`--brand`, `--success`, `--warning`, `--danger`, `--info`) y ajustar cada par de texto/superficie para mantener contraste WCAG AA. No reutilizar un color de estado para una decoración sin relación semántica.

## Superficies y profundidad

- Superficies frías azuladas, con cambio de luminosidad entre canvas, tarjetas y controles.
- Usar sombras sutiles en tema claro para tarjetas elevadas; en oscuro, reducir la sombra y privilegiar bordes discretos.
- Radios: 8px (xs), 12px (sm), 16px (base), 20px (lg), 24px (xl).
- Evitar fondos saturados extensos, gradientes ornamentales y bordes que dominen la vista.

## Jerarquía y tipografía

- Mantener la pila SF Pro / sistema ya establecida por los tokens del proyecto; no añadir fuentes ni dependencias.
- El título y la cifra principal lideran; etiquetas, descripción y metadatos usan tamaños, pesos y colores progresivamente secundarios.
- Conservar números tabulares para valores dinámicos.
- Equilibrar el azul de marca con el violeta en gráficos, identidad y permisos; semáforo visual solo para estados de acceso.

## Espaciado, navegación e interacción

- Base de espaciado: 4px; utilizar la escala existente `--space-1` a `--space-16` en múltiplos de 4.
- Mantener la distribución, el orden, la navegación y el flujo de los módulos existentes.
- La navegación activa muestra fondo azul pálido y una marca azul lateral; hover y foco deben ser distinguibles en ambos temas.
- Los botones principales comparten el azul de acción. Los filtros y búsquedas comparten fondo y borde en todos los módulos.
- Los controles conservan estados hover, active, focus-visible y disabled; no depender exclusivamente de hover. Respetar `prefers-reduced-motion`.

## Componentes establecidos

- **Filtro/búsqueda:** 44px mínimo de alto, fondo y borde dedicados según tema; icono de búsqueda azul; placeholder con contraste suficiente.
- **Métrica del dashboard:** cifra tabular como foco, etiqueta secundaria, icono en fondo semántico y filete superior de acento según el tipo de dato.
- **Acción principal:** botón azul con texto de alto contraste; acción destructiva usa token rojo y texto ajustado por tema.
- **Navegación activa:** acento lateral azul más fondo tintado; conserva el orden y las rutas existentes.
- **Badges y avatar:** fondos suaves semánticos con texto de contraste; mantener una interpretación coherente entre vistas.

## Límites

- Estos patrones aplican al selector de paneles, las pantallas administrativas y la pantalla de acceso denegado.
- El login, su animación/medio audiovisual y los tokens raíz que determinan su apariencia no se modifican.
- Preferir cambios SCSS; no alterar templates, lógica, rutas, permisos ni flujo para resolver asuntos visuales.
