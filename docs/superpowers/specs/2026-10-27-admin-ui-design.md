# Diseño: renovación visual del portal administrativo

**Estado:** aprobado por el usuario  
**Fecha:** 2026-10-27

## Intención

Hacer que el portal de control de accesos se sienta más vivo, memorable y profesional que su actual tratamiento monocromático inspirado en Apple, sin perder su claridad. Está dirigido a quienes administran identidades, usuarios, roles y permisos y necesitan reconocer rápidamente qué pueden hacer y cuál es el estado de cada acceso.

## Dirección visual acordada

Usar color intenso de forma deliberada y repetible: asignar un color a cada función visual y mantenerlo igual en todas las pantallas. Los campos de búsqueda/filtro deben compartir el mismo tratamiento; también las acciones principales, navegación activa e indicadores semánticos. Los estados de acceso conservan significados consistentes (permitido, atención, denegado e inactivo), no colores decorativos.

La firma será un «rastro de acceso»: un acento saturado claramente reconocible en la navegación activa y las acciones relevantes, apoyado por varios acentos funcionales sin convertir cada tarjeta en un bloque de color. Mantener el aire, la legibilidad y el carácter pulido del diseño actual, pero con más energía. La paleta exacta y sus pares de contraste quedan a cargo de implementación, respetando esta semántica y verificando ambos temas.

## Alcance y límites

- Rediseñar visualmente el selector de paneles, las vistas administrativas existentes (dashboard, usuarios, roles y permisos) y la pantalla de acceso denegado, incluidos sus controles y estados.
- Cubrir los temas claro y oscuro existentes; conservar el selector de tema y su comportamiento.
- Cambiar solo estilos. No editar plantillas HTML, TypeScript, rutas, permisos, datos ni interacciones.
- Conservar la estructura del código, la jerarquía y el orden del contenido, la navegación y el flujo de paneles y módulos. Se permiten ajustes de presentación CSS sin reorganizar secciones.
- No modificar ni cambiar visualmente el login ni su elemento audiovisual. Los tokens globales compartidos con el login no deben cambiar su apariencia.
- No añadir dependencias ni modificar la API o el comportamiento de componentes.

## Objetivos

- Crear una jerarquía más nítida mediante contraste, peso tipográfico y color con intención.
- Aplicar colores vivos con reglas constantes entre selector, dashboard, tablas, formularios, filtros, acciones, navegación y estados.
- Mejorar la lectura y la diferenciación visual de tablas, métricas, gráficos, formularios y estados vacíos, de carga y error sin alterar su contenido ni funcionamiento.
- Mantener contraste legible, foco de teclado, estados interactivos y soporte para movimiento reducido y tamaños móviles.
- Asegurar que el login conserve su aspecto y que el tema claro/oscuro funcione en todas las vistas incluidas.

## No objetivos y antiobjetivos

- No crear módulos ni secciones, no reordenar ni ocultar contenido, y no modificar el flujo entre paneles.
- No rediseñar el login, su animación ni ningún medio audiovisual.
- Evitar colores aleatorios por tarjeta, diferentes tonos para el mismo tipo de control, fondos saturados extensos, gradientes decorativos y pérdida de legibilidad en modo oscuro.
- Evitar cambios de comportamiento disfrazados de retoques visuales.

## Enfoques considerados

1. **Color por función (seleccionado):** colores potentes y consistentes para familias de elementos en todas las pantallas. Favorece coherencia, reconocimiento y una evolución profesional de la identidad actual.
2. **Color por módulo:** un acento particular para Usuarios, Roles y Permisos, conservando el color compartido de filtros, acciones y estados. Aumenta la diferenciación entre secciones, pero requiere más reglas y puede debilitar la unidad del producto.
3. **Consola nocturna:** hacer del grafito la superficie dominante y contrastarlo con acentos luminosos. Sería más dramático, pero se aleja del carácter Apple que se quiere conservar y reduce la continuidad con el tema claro.

Se eligió el primero para satisfacer la solicitud de usar varios colores fuertes y mantener cada familia de controles visualmente igual en toda la aplicación.

## Criterios de implementación y aceptación

- Trabajar sobre los estilos de `frontend/src/app/features/launcher/` y `frontend/src/app/features/panels/admin/`, además de los estilos compartidos estrictamente necesarios.
- Mantener los tokens o reglas de color nuevos limitados al selector y al shell administrativo. No cambiar valores raíz consumidos por el login; los controles compartidos dentro de las vistas incluidas deben heredar el tema visual acotado a esas áreas.
- Reutilizar la paleta semántica existente como punto de partida y ajustar colores, superficies, bordes, tipografía, densidad y estados sin cambiar la estructura del DOM.
- Revisar las cuatro vistas y el selector en ambos temas, en móvil y escritorio. Confirmar que los filtros, botones, navegación y estados de una misma familia usan tratamientos consistentes, que el foco y el contraste siguen siendo visibles y que las tablas y formularios conservan su comportamiento.
- Confirmar que el login y su elemento audiovisual no presentan cambios visuales.
- Ejecutar la compilación Angular existente; no incorporar bibliotecas ni cambiar lógica para facilitar el diseño.

## Decisiones para quien implemente

Elegir los valores concretos de la paleta, su correspondencia con los tokens semánticos, los niveles sutiles de superficie y los detalles tipográficos según las reglas de consistencia anteriores. Priorizar color significativo, contraste accesible y una apariencia viva pero controlada; no cambiar estructura ni flujo para resolver problemas de composición.
