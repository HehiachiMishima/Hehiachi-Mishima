# Fuentes autoalojadas

La CSP solo permite `font-src 'self'`, así que las fuentes se sirven desde aquí.

| Archivo | Familia | Peso | Subconjunto | Licencia |
|---|---|---|---|---|
| `inter-latin-wght-normal.woff2` | Inter Variable | 100–900 (se usa 200–800) | latin | SIL Open Font License 1.1 |
| `inter-latin-ext-wght-normal.woff2` | Inter Variable | 100–900 | latin-ext | SIL Open Font License 1.1 |
| `plus-jakarta-sans-latin-wght-normal.woff2` | Plus Jakarta Sans Variable | 200–800 | latin | SIL Open Font License 1.1 |
| `plus-jakarta-sans-latin-ext-wght-normal.woff2` | Plus Jakarta Sans Variable | 200–800 | latin-ext | SIL Open Font License 1.1 |
| `jetbrains-mono-latin-400.woff2` | JetBrains Mono | 400 | latin | SIL Open Font License 1.1 |
| `jetbrains-mono-latin-ext-400.woff2` | JetBrains Mono | 400 | latin-ext | SIL Open Font License 1.1 |

- Inter es © 2016 The Inter Project Authors (https://github.com/rsms/inter): interfaz y tablas.
- Plus Jakarta Sans es © 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans): títulos, KPIs y marca.
- JetBrains Mono es © 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono): códigos de permiso, identificadores, horas e IP.

Todas se distribuyen bajo la SIL Open Font License, Version 1.1 (https://openfontlicense.org).
Los archivos son los subconjuntos de Fontsource (`@fontsource-variable/inter` 5.3.0,
`@fontsource-variable/plus-jakarta-sans` 5.3.0), sin modificar. Los de latin-ext solo se descargan si
la página usa caracteres de ese rango (`unicode-range`).

Se cargan con `@font-face` en `src/styles/_base.scss`.
