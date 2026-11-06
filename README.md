# Plataforma de Control de Accesos

Plantilla base para construir sistemas internos con **gestión de identidades, roles y permisos (RBAC)**, **ajustes individuales por usuario con regla _deny-wins_** y **bitácora de auditoría inmutable**. Se despliega como **una sola imagen Docker** (nginx + Spring Boot) contra una **base de datos PostgreSQL externa**.

| Capa | Tecnología |
|---|---|
| Frontend | Angular 22 (standalone, zoneless) + SCSS, sin librerías de UI. Sistema de diseño «consola plana» (ver `frontend/DESIGN-HANDOFF.md`) |
| Backend | Spring Boot 4.1.2 sobre Java 25, Spring MVC + JPA/Hibernate (síncrono, hilos virtuales, sin Reactor), Spring Security (resource server JWT HS256) |
| Base de datos | PostgreSQL 15 o superior (probada con 17). Todo el esquema está en un único archivo, `backend/schema.sql`, que se aplica a mano con `psql`. Sin Flyway, sin migraciones y sin `ddl-auto` |
| Despliegue | Dockerfile único (nginx + supervisord + Spring Boot) para Render. La BD es externa a la imagen (Render PostgreSQL, declarada en `render.yaml`) |

**Inicio rápido:** [Desarrollo local](#9-desarrollo-local) · [Despliegue en Render](#11-despliegue-en-render) · [Referencia de API](#12-referencia-de-api) · [Cómo usar esta base](#15-cómo-usar-esta-base-para-un-sistema-nuevo)

---

## Índice

1. [Estado de esta versión](#1-estado-de-esta-versión)
2. [Arquitectura](#2-arquitectura)
3. [Modelo de acceso y reglas anti-escalada](#3-modelo-de-acceso-y-reglas-anti-escalada)
4. [Bitácora de auditoría](#4-bitácora-de-auditoría)
5. [Estructura del repositorio](#5-estructura-del-repositorio)
6. [Requisitos](#6-requisitos)
7. [Configuración (variables de entorno)](#7-configuración-variables-de-entorno)
8. [Base de datos](#8-base-de-datos)
9. [Desarrollo local](#9-desarrollo-local)
10. [Pruebas](#10-pruebas)
11. [Despliegue en Render](#11-despliegue-en-render)
12. [Referencia de API](#12-referencia-de-api)
13. [Accesibilidad](#13-accesibilidad)
14. [Riesgos y pendientes conocidos](#14-riesgos-y-pendientes-conocidos)
15. [Cómo usar esta base para un sistema nuevo](#15-cómo-usar-esta-base-para-un-sistema-nuevo)

---

## 1. Estado de esta versión

### Resultados verificados

| Verificación | Resultado |
|---|---|
| `cd backend && ./mvnw -B verify` | **264 tests: 263 pasan, 0 fallan, 1 omitido** (la prueba de carga, que es opt-in). Usa PostgreSQL 17 real (`postgres:17-alpine`) vía Testcontainers |
| `cd frontend && npx ng build` | OK, sin avisos de budget. Bundle inicial de ~360 kB |
| `docker build .` | OK |
| Prueba de humo del contenedor con una BD temporal (medida en la versión anterior, con MySQL; pendiente de repetir con PostgreSQL) | `/api/health` → 204 a los ~18 s; login correcto; eventos `LOGIN_EXITOSO` y `LOGIN_FALLIDO` registrados; export CSV de auditoría; deep links del SPA servidos por nginx; `/actuator/env` → 404; memoria ~318 MiB de 512 MiB |
| Contraste de color (script WCAG sobre los tokens finales) | 62 pares OK, 0 fallos, en tema claro y oscuro |

**No verificado todavía:** el workflow de GitHub Actions no se ha ejecutado en GitHub (no hubo push), el despliegue real en Render (incluida la IP real del cliente), lectores de pantalla y carga sostenida en un entorno dedicado.

### Qué cambió, por área

**Migración a PostgreSQL (versión actual)**
- La BD pasa de MySQL 8 a **PostgreSQL ≥ 15** (probada con 17). Todo el esquema vive en `backend/schema.sql`, repartido en los schemas `comun`, `seguridad` y `bitacora`, y se aplica a mano con `psql` (ver [§8](#8-base-de-datos)). Desaparecen `protection.admin.sql` y `migrations/V2__auditoria.sql`.
- Backend sin Reactor: controladores y servicios son síncronos sobre hilos virtuales. BCrypt corre en un pool acotado de hilos de plataforma y los filtros de búsqueda son `Specification` dinámicas de JPA.
- Frontend rediseñado con el sistema «consola plana» (ver la sección *Frontend, UX y UI*).

El historial que sigue describe la versión anterior, que corría sobre MySQL 8. Las menciones a MySQL, triggers `SIGNAL`, `protection.admin.sql` o V2 son históricas: el estado vigente está en las secciones 2 a 15.

**Arquitectura y escalabilidad**
- Agregaciones globales reescritas. Medido con datos sintéticos (20 000 usuarios, 770 000 pares usuario×permiso):
  - el resumen de usuarios pasa de ~164 s a ~97 ms por cada 100 usuarios, porque consulta por lotes de ids en vez de materializar la vista entera;
  - la cobertura de paneles pasa de ~9,3 s a ~0,54 s (reescrita con `EXISTS`, mismos resultados).
- Sin N+1: relaciones `@ManyToOne(fetch = LAZY)` y `JOIN FETCH` en los overrides.
- Listados acotados (máximo 5 000 filas, orden determinista) y búsquedas sin `LOWER()`, que impedía usar índices.
- `GET /api/usuarios/resumen?ids=…` (máximo 500 ids): el frontend pide solo la página visible.
- Nuevo perfil `application-prod.properties`: pool Hikari de 5 conexiones, 50 hilos Tomcat, apagado ordenado (25 s), logs JSON (ECS) con `requestId` y Actuator limitado a `health`.

**Seguridad**
- Reglas anti-escalada centralizadas en `GuardiaPrivilegios` (ver [§3](#3-modelo-de-acceso-y-reglas-anti-escalada)). Cierran tres escaladas críticas detectadas en la revisión: auto-concederse permisos vía un rol propio, dar ADMINISTRADOR a una cuenta títere y tomar cuentas reseteando contraseñas ajenas.
- **Revocación de JWT** con el claim `ver` (= `usuarios.credenciales_version`). La versión sube al cambiar o resetear la contraseña, al renombrar y al desactivar. `PUT /api/auth/contrasena` devuelve un token nuevo.
- **Fuerza bruta:**
  - limitador atómico antes de BCrypt: 10 intentos/min por IP+usuario y 30/min por IP, con 429 y `Retry-After: 60`;
  - bloqueo por cuenta persistido en BD: desde el 5.º fallo, 1, 2, 4… minutos, con tope de 60;
  - `limit_req` en nginx: 20 r/min con ráfaga de 10.
- Política de contraseñas `@ContrasenaSegura`: de 12 caracteres a 72 bytes UTF-8, con letras y números, y fuera de una lista de triviales.
- Nombres de usuario reservados (`@hehiachi`, el usuario semilla y `USUARIOS_PROTEGIDOS`) que no se pueden ocupar ni renombrar, sin distinguir mayúsculas.
- Login sin enumeración de cuentas: mensaje genérico también para cuentas desactivadas, y la credencial tecleada nunca se escribe en logs.
- Cabeceras en nginx:
  - CSP estricta (`script-src 'self'` más el hash calculado en el build);
  - HSTS solo bajo HTTPS;
  - COOP y CORP;
  - `X-Frame-Options DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`.
- Contenedor sin root (uid 10001), imágenes base fijadas por digest y sistema de archivos de solo lectura en compose.
- CORS con `allowCredentials(false)`. Expone solo `X-Request-Id` y `Content-Disposition`.
- Frontend:
  - el token vive en `sessionStorage` (por pestaña), no en `localStorage`;
  - el interceptor solo envía el `Bearer` a `environment.apiUrl`.

**RBAC**
- El campo `protegido: boolean` en usuarios, roles y permisos permite que la UI deshabilite lo que el backend rechazaría.
- `PermisoEfectivoResponse.roles[]` explica qué rol concede cada permiso, base de la columna «Por qué» de la UI.
- Corregido BUG-2: un permiso inactivo impedía a un ADMINISTRADOR asignar el rol ADMINISTRADOR. El arreglo está en `GuardiaPrivilegios.exigirPoseerPermisosDeRol` y su test de regresión está activo.

**Auditoría**
- Nueva bitácora append-only `auditoria_eventos`, con 24 acciones, consulta filtrable, historial por entidad (`relacionadoCon`) y export CSV seguro. Detalles en [§4](#4-bitácora-de-auditoría).
- Nuevo permiso base `VER_AUDITORIA`.

**Base de datos**
- Tabla `auditoria_eventos` con 5 índices, `CHECK` sobre `resultado` y triggers que impiden `UPDATE` y `DELETE`.
- Columnas nuevas en `usuarios`: `credenciales_version`, `intentos_fallidos` y `bloqueado_hasta`.
- El trigger de `@hehiachi` siguió bloqueando su identidad y credenciales, pero pasó a permitir actualizar los contadores de bloqueo. (En esa versión vivía en `protection.admin.sql` y había una migración `V2__auditoria.sql`; hoy ambas cosas están dentro de `schema.sql`.)

**Frontend, UX y UI**
- Nuevo módulo **Auditoría**:
  - filtros guardados en la URL y vistas guardadas;
  - tabla agrupada por día;
  - detalle lateral con la tabla antes/después;
  - export CSV.
- Historial por usuario y por rol.
- Dashboard ejecutivo sobre `GET /api/admin/analitica`:
  - KPIs de riesgo y bloque «Requiere atención»;
  - nunca muestra un «0» falso: cada métrica tiene estados de carga, error y dato.
- Confirmaciones con impacto («N usuarios dejarán de recibir P permisos»), «Deshacer» al quitar un permiso de un rol y motivo opcional que llega a la bitácora.
- Menú de cuenta con «Cambiar contraseña». El reset de la contraseña de otro usuario es una acción propia, separada del formulario de edición.
- Filtros de Usuarios en la URL, paginador con rango y tamaño de página, y un único aviso por error, mostrado en el campo que falló.
- **Arquitectura login → paneles → módulos.** Cada panel (hoy: *Administración*, en `/admin`) agrupa sus módulos bajo `/<panel>/<módulo>`, con su navegación por secciones y su tono de marca. Todo sale del registro `src/app/paneles/registro.ts`: rutas, guards (de panel y de módulo), selector de paneles (`/paneles`), conmutador de panel en la barra lateral, miga de pan, títulos, paleta Ctrl/⌘K y la salida de «Acceso denegado». Tras el login siempre se llega al portal de paneles (`/paneles`), aunque solo haya uno; desde ahí se entra al panel y a sus módulos, y dentro del panel la marca de la barra lateral permite volver o cambiar de panel. El shell (`layout/PanelShell`) es único y genérico: recibe su panel por la ruta y lo comparte con sus módulos mediante `PANEL_ACTUAL`. Shell y módulos se cargan de forma diferida (bundle inicial ~360 kB).
- **Rediseño «consola plana» (versión actual).** Sustituye por completo a «Aurora de cristal»: esquinas rectas, superficies sin sombra delimitadas por bordes finos, neutros grises con un único acento violeta, tipografías Geist y Geist Mono, y tema claro y oscuro. Se retiraron el fondo WebGL del login y las fuentes Inter y Plus Jakarta Sans. La especificación está en `frontend/DESIGN-HANDOFF.md`, y los tokens, temas y mixins en `frontend/src/styles/`.
- *Histórico:* **Rediseño ejecutivo «Aurora de cristal»** (dirección de `ui-ux-pro-max`: glassmorphism sobre fondo vivo, base oscura y colores de estado):
  - fondo aurora fijo (radiales índigo, fucsia, cian y violeta) y superficies de cristal esmerilado (`--glass-*`), con respaldo opaco si el navegador no soporta `backdrop-filter` y sin efectos en `forced-colors`;
  - portal `/paneles` como centro de mando: saludo, cifras y una tarjeta grande por panel con su identidad en degradado y accesos directos a cada módulo; con varios paneles, rejilla bento;
  - barra lateral de cristal nocturno con la placa del panel (tono, nombre, conmutador) y «Todos los paneles»; cada módulo lleva cabecera con su icono y el panel al que pertenece;
  - cada panel tiene su `tono` (`indigo`, `violeta`, `esmeralda`, `ambar`, `cian`, `rosa`) en `_tokens.scss` bajo `[data-tono]`;
  - Resumen con hero en degradado y KPIs destacados en degradado completo (los de riesgo en ámbar, rosa o rojo cuando tienen valor);
  - Inter y Plus Jakarta Sans autoalojadas (OFL, compatibles con la CSP) y JetBrains Mono para códigos, horas e IP;
  - contraste AA en claro y oscuro medido contra el punto más claro/oscuro de la aurora: 0 fallos (peor texto 4,71:1);
  - la decisión de diseño está en `frontend/design-system/control-de-accesos/MASTER.md`.
- **Responsive verificado** a 360, 390, 768, 1024, 1280, 1440 y 1920 px, sin scroll horizontal:

  | Ancho | Barra lateral | Tablas | Modales / detalle |
  |---|---|---|---|
  | < 768 px | Cajón modal (safe areas) | Una tarjeta por fila; filtros plegables | Hoja inferior / pantalla completa |
  | 768–1023 px | Cajón modal | Columnas prioritarias | Centrados / lateral |
  | 1024–1279 px | Fija, expandida o compacta (solo iconos) | Columnas prioritarias | Centrados / lateral |
  | ≥ 1280 px | Fija, expandida o compacta | Tabla completa, cabecera fija, columnas redimensionables | Centrados / lateral |

  Con puntero táctil (`pointer: coarse`), todos los controles miden al menos 44 px. La barra superior lleva migas, buscador de módulos (Ctrl/⌘K), tema y cuenta.

**Accesibilidad**
- Se corrigieron los hallazgos críticos y serios de la auditoría WCAG 2.2 AA:
  - etiquetas asociadas en todos los formularios;
  - switches con `role="switch"`;
  - foco visible con contraste suficiente;
  - live regions;
  - gestión de foco en modales y en la navegación;
  - títulos por ruta;
  - redimensionado de columnas por teclado.
- Estado y límites en [§13](#13-accesibilidad).

**DevOps**
- Dockerfile multi-stage reescrito:
  - jar extraído para un arranque más rápido;
  - `HEALTHCHECK`;
  - JVM dimensionada para 512 MB.
- supervisord como PID 1, con parada ordenada: nginx drena y después Spring hace un apagado ordenado.
- Si un proceso queda en estado `FATAL`, el contenedor sale y Render lo reinicia. Así no queda un nginx «verde» sin API detrás.
- nginx:
  - toma la IP real con `real_ip` y sobrescribe `X-Forwarded-For`, de modo que el cliente no puede falsificarla;
  - acepta un `X-Request-Id` entrante solo si cumple `[A-Za-z0-9_-]{8,64}`, la misma regla que el backend;
  - devuelve 503 en JSON mientras el backend arranca;
  - bloquea `/actuator/*` salvo los health probes.
- `render.yaml` (Blueprint) y `docker-compose.yml`, este último con un perfil opcional `db-local`.
- CI en `.github/workflows/ci.yml`:
  - `mvn verify` con Testcontainers (PostgreSQL 17; no usa un servicio de BD del runner);
  - `ng build`;
  - `docker build` sin push y prueba de humo del contenedor.

**Pruebas**
- Suite de integración nueva: Tomcat real y PostgreSQL 17 vía Testcontainers. Ver [§10](#10-pruebas).
- La matriz de autorización se genera desde los `@PreAuthorize`: cualquier endpoint nuevo sin protección rompe la build.

---

## 2. Arquitectura

Un único contenedor, un único puerto público:

```
        Navegador
            │  HTTPS (Render termina TLS)
            ▼
┌──────────────────────── Contenedor (uid 10001, supervisord = PID 1) ───────────────────────┐
│                                                                                             │
│   nginx  :PORT (10000, único puerto expuesto)                                               │
│     ├── /                 → SPA Angular (index.html no-cache; .js/.css inmutables 1 año)    │
│     ├── /api/*            → proxy a 127.0.0.1:BACKEND_PORT  (limit_req en /api/auth/login)  │
│     ├── /actuator/health[/liveness|/readiness] → backend;  resto de /actuator → 404         │
│     └── cabeceras: CSP, HSTS (solo https), COOP, CORP, X-Request-Id                         │
│                    │                                                                        │
│                    ▼                                                                        │
│   Spring Boot  127.0.0.1:BACKEND_PORT (2003, interno)                                       │
│     JWT HS256 · RBAC + overrides · GuardiaPrivilegios · bitácora asíncrona                  │
│                    │                                                                        │
└────────────────────┼────────────────────────────────────────────────────────────────────────┘
                     │  JDBC (sslmode configurable, pool Hikari de 5 en Render)
                     ▼
        PostgreSQL ≥ 15 EXTERNA (Render PostgreSQL u otra)  ← NO va en la imagen
        schemas: comun · seguridad · bitacora
```

- El SPA usa `apiUrl: '/api'` (mismo origen), así que el navegador no hace peticiones CORS entre SPA y API.
- El health check de Render es `GET /api/health`, que responde `204` sin consultar la BD. Así, un corte breve de la BD externa no hace que Render reinicie el servicio.
- Respuestas JSON: `ApiResponse<T>` `{exito, mensaje, datos, timestamp}`. Errores: `ApiError` `{timestamp, status, error, mensaje, ruta, campos}`. Todas llevan la cabecera `X-Request-Id`, que también aparece en los logs de nginx y de Spring y en `auditoria_eventos.id_correlacion`.
- Paquetes del backend:
  - `oracle.auth`: login, sesión y cambio de contraseña;
  - `oracle.admin.{controller,service,repository,model,request,response}`: el RBAC;
  - `oracle.auditoria`: la bitácora;
  - `oracle.common.*`: seguridad, configuración, validación y soporte.

---

## 3. Modelo de acceso y reglas anti-escalada

### Resolución de permisos

```
usuario ──< usuarios_roles >── rol ──< roles_permisos >── permiso
   └─────────────< usuarios_permisos (otorgado = TRUE | FALSE) >──────┘
```

1. Un usuario recibe los permisos de sus **roles activos**, y solo cuentan los **permisos activos**.
2. Un **override** por usuario puede conceder (`otorgado = TRUE`) o denegar (`otorgado = FALSE`) un permiso concreto.
3. **Deny-wins:** una denegación individual prevalece siempre sobre cualquier rol.
4. La resolución vive en las vistas `seguridad.v_permisos_efectivos` y `seguridad.v_permisos_finales` (esta última agrega con `bool_and(otorgado)`: basta una denegación para negar) y en la función `seguridad.permisos_de(usuario_id)`. La aplicación la consulta filtrando por usuario y la cachea en `AutorizacionCache`, que se invalida tras cada commit relevante. Los cambios de roles o permisos se aplican **en la siguiente petición**, sin re-login.

### Permisos base (17, protegidos)

`VER_USUARIOS`, `CREAR_USUARIOS`, `MODIFICAR_USUARIOS`, `ELIMINAR_USUARIOS`, `VER_ROLES`, `CREAR_ROLES`, `MODIFICAR_ROLES`, `ELIMINAR_ROLES`, `ASIGNAR_ROLES`, `VER_PERMISOS`, `CREAR_PERMISOS`, `MODIFICAR_PERMISOS`, `ELIMINAR_PERMISOS`, `ASIGNAR_PERMISOS`, `PANEL_ADMIN`, `DASHBOARD_ADMIN`, `VER_AUDITORIA`.

No se pueden renombrar, editar, desactivar ni eliminar. Tampoco se puede crear otro permiso con uno de estos nombres. Lo impiden tanto la aplicación (`Protecciones.PERMISOS_BASE`) como la BD (trigger `trg_permisos_proteger` y función `seguridad.es_permiso_base`). Los triggers de protección lanzan `SQLSTATE 'RB403'`, que el backend traduce a HTTP 403.

### Protecciones

| Objeto | Qué se impide | Dónde |
|---|---|---|
| Rol `ADMINISTRADOR` | Editarlo, renombrarlo, desactivarlo, eliminarlo o quitarle permisos. Solo se le pueden **agregar** permisos, y un trigger le asigna automáticamente cada permiso nuevo | App + BD |
| `@hehiachi` (usuario raíz) | Cualquier cambio de identidad, credencial o estado, su borrado y cambios en sus roles o permisos. Tampoco puede cambiar su propia contraseña | App + BD (`seguridad.es_usuario_protegido` y triggers de `schema.sql`) |
| Usuario semilla (`USER_ADMIN`) y `USUARIOS_PROTEGIDOS` | Que otro administrador lo gestione. **Sí puede** cambiar su propia contraseña | App. En la BD, `schema.sql` protege por nombre a `@admin` y `@hehiachi` |
| Nombres reservados | Crear o renombrar un usuario a un nombre protegido (sin distinguir mayúsculas) | App |
| La propia cuenta | Gestionar los propios roles, permisos, estado o borrado desde la administración | App |

Las cuentas protegidas **también** se bloquean por fuerza bruta (como máximo 60 min). Es una decisión explícita: se prioriza defender la cuenta más valiosa frente a un DoS acotado.

### `GuardiaPrivilegios`: «nadie concede lo que no tiene»

Archivo: `backend/src/main/java/oracle/admin/service/GuardiaPrivilegios.java`. El actor `0` (sistema) queda exento.

| Regla | Efecto |
|---|---|
| `exigirPoseer` | Para conceder o retirar un permiso (a un rol, o como grant o deny a un usuario) hay que **poseerlo** |
| `exigirPoseerPermisosDeRol` | Para asignar un rol hay que poseer todos sus permisos. Un ADMINISTRADOR no necesita poseer los **inactivos** (corrección de BUG-2). Un no-admin sí, para que no pueda asignar un rol con un permiso apagado y reactivarlo después |
| `exigirAutoridadSobre` | No se puede actuar sobre uno mismo ni sobre un usuario con permisos que el actor no tiene. A un ADMINISTRADOR solo lo gestiona otro ADMINISTRADOR |
| `exigirAdministradorSiRolAdmin` | Solo un ADMINISTRADOR asigna, quita o amplía el rol ADMINISTRADOR |
| `exigirRolAjeno` | Un no-admin no puede alterar los permisos de un rol que él mismo tiene |
| `exigirNoAutoBeneficio` | Un no-admin no puede reactivar un permiso que él mismo recibiría (por rol o por grant). En el caso de un rol, reactivarlo exige poseer sus permisos (`exigirPoseerPermisosDeRol`) |

Las reglas se aplican en los servicios de roles, permisos, usuarios, asignaciones usuario-rol y rol-permiso, y overrides. Un intento rechazado devuelve **403** y queda registrado como `ACCESO_DENEGADO`. Los escenarios de explotación de la revisión de seguridad están cubiertos por `EscaladaPrivilegiosTest`, que también comprueba en la BD que nada cambió.

### Sesión

- JWT HS256 con `iss`, `sub` (id de usuario) y `ver`, y una vida por defecto de 15 min (1 h en `render.yaml`; `JWT_EXPIRATION_MS`).
- Se rechazan (401):
  - los tokens sin `ver` o con una versión distinta de la de la BD;
  - los firmados con otra clave o con `alg:none`;
  - los expirados o con otro emisor.
- El frontend avisa 2 minutos antes del vencimiento. Ante un 401 con el token aún vigente, lo trata como una sesión revocada.
- **No hay logout en el servidor** (ver [§14](#14-riesgos-y-pendientes-conocidos)). Cerrar sesión borra el token del navegador.

---

## 4. Bitácora de auditoría

### Tabla `auditoria_eventos` (append-only)

Vive en el schema `bitacora` (`bitacora.auditoria_eventos`).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | BIGINT `GENERATED ALWAYS AS IDENTITY` PK | |
| `ocurrido_en` | TIMESTAMPTZ | En UTC: el instante del evento, no el del INSERT |
| `actor_id` | BIGINT NULL | `NULL` = anónimo (login fallido), `0` = sistema |
| `actor_usuario` | VARCHAR(100) NULL | Login del actor en el momento del evento. En `LOGIN_FALLIDO` contra una cuenta inexistente es `NULL` |
| `accion` | VARCHAR(40) | Ver el catálogo. `CHECK` `^[A-Z_]+$` |
| `entidad` | VARCHAR(30) NULL | `USUARIO`, `ROL`, `PERMISO`, `USUARIO_ROL`, `ROL_PERMISO`, `USUARIO_PERMISO`, `SESION` |
| `entidad_id` | VARCHAR(64) NULL | En las relaciones es compuesto: `usuarioId:rolId`, `rolId:permisoId` o `usuarioId:permisoId` |
| `resultado` | enum `bitacora.resultado_auditoria` | `EXITO`, `FALLO` o `DENEGADO` |
| `ip` | INET NULL | Una IP inválida se guarda como `NULL` (función `bitacora.a_inet`), nunca rompe el INSERT |
| `user_agent`, `id_correlacion` | VARCHAR | Truncados a 255 / 64. Los caracteres de control se sustituyen |
| `detalle` | JSONB NULL | `{antes, despues}` o `{motivo, …}` (`CHECK`: siempre un objeto). **Nunca** contiene contraseñas, hashes ni tokens: una contraseña cambiada aparece como `"(cambiada)"` |

- Índices: `(ocurrido_en DESC, id DESC)`, `(actor_id, ocurrido_en DESC)`, `(entidad, entidad_id, ocurrido_en DESC)`, `(accion, ocurrido_en DESC)`, uno parcial `(resultado, ocurrido_en DESC) WHERE resultado <> 'EXITO'`, uno parcial sobre `id_correlacion` y un GIN `jsonb_path_ops` sobre `detalle`.
- Los triggers `trg_auditoria_solo_insercion` (`UPDATE` y `DELETE`, por fila) y `trg_auditoria_sin_truncate` (`TRUNCATE`, por sentencia) lanzan `SQLSTATE 'RB403'`. A diferencia de MySQL, PostgreSQL sí dispara triggers en `TRUNCATE`. `DROP TABLE` no dispara triggers, y el dueño de la tabla o un superusuario puede desactivarlos; por eso hay que restringir igualmente los privilegios del usuario de la aplicación (ver el [GRANT recomendado](#grant-recomendado)).

### Acciones registradas

| Grupo | Acciones |
|---|---|
| Sesión | `LOGIN_EXITOSO`, `LOGIN_FALLIDO`, `LOGIN_BLOQUEADO` (cuenta bloqueada o límite de intentos), `CONTRASENA_CAMBIADA` |
| Usuarios | `USUARIO_CREADO`, `USUARIO_ACTUALIZADO`, `USUARIO_ELIMINADO`, `USUARIO_ESTADO_CAMBIADO` |
| Roles | `ROL_CREADO`, `ROL_ACTUALIZADO`, `ROL_ELIMINADO`, `ROL_ESTADO_CAMBIADO` |
| Permisos | `PERMISO_CREADO`, `PERMISO_ACTUALIZADO`, `PERMISO_ELIMINADO`, `PERMISO_ESTADO_CAMBIADO` |
| Asignaciones | `ROL_ASIGNADO`, `ROL_REVOCADO`, `PERMISO_ASIGNADO_ROL`, `PERMISO_REVOCADO_ROL`, `OVERRIDE_ESTABLECIDO`, `OVERRIDE_ELIMINADO` |
| Seguridad | `ACCESO_DENEGADO` (403 de `@PreAuthorize`, de reglas de negocio o de un trigger), `AUDITORIA_EXPORTADA` (quién exportó y con qué filtros) |

En `LOGIN_FALLIDO` con una credencial desconocida no se guarda lo que se tecleó (podría ser una contraseña). Se guarda una huella HMAC-SHA256 truncada a 12 caracteres hex, calculada con `JWT_SECRET`.

### Cómo se escribe

- `RegistroAuditoria.registrar()` **nunca lanza ni bloquea** la petición. Si la bitácora falla, la operación de negocio sigue adelante y el fallo queda en un log `ERROR`.
- Los eventos `EXITO` se encolan *después del commit*, así que un rollback no deja un éxito falso. `FALLO` y `DENEGADO` se encolan de inmediato.
- Hay una cola en memoria (`AUDITORIA_CAPACIDAD_COLA`, 10 000) y un hilo `auditoria-escritor` que inserta por lotes de hasta 200 filas. Si la cola se llena, el evento se descarta con un log `ERROR`. Al apagar, la cola se vacía durante un máximo de 5 s.
- Métricas Micrometer: `auditoria.eventos{estado=encolado|escrito|descartado|fallido}` y `auditoria.cola.tamano`. En prod no se exponen por HTTP (Actuator solo publica `health`).

### API (todo con `VER_AUDITORIA`)

- `GET /api/auditoria`
  - Parámetros: `pagina` (1), `tamano` (25, máx. 100), `desde`, `hasta`, `actorId`, `accion`, `entidad`, `entidadId`, `resultado`, `q` y `relacionadoCon`.
  - `accion`, `entidad` y `resultado` aceptan varios valores separados por comas. Un valor desconocido devuelve 400.
  - `relacionadoCon=USUARIO:42`, `ROL:7` o `PERMISO:3` incluye las relaciones compuestas (asignaciones y overrides). Es el historial de un registro.
  - `q` busca por prefijo en `actor_usuario` y por coincidencia exacta en `entidad_id` o `id_correlacion`. No busca dentro de `detalle`.
  - Sin fechas ni filtro selectivo, el rango por defecto son los **últimos 30 días**.
  - El total y la profundidad navegable tienen un tope de **50 000**. Más allá responde 400, pidiendo acotar los filtros.
  - Las fechas ISO sin zona se interpretan en UTC. `ocurridoEn` se devuelve con `Z`.
- `GET /api/auditoria/{id}`: devuelve un evento.
- `GET /api/auditoria/catalogo`: devuelve `{acciones, entidades, resultados}`.
- `GET /api/auditoria/exportar`
  - Admite los mismos filtros.
  - Devuelve `text/csv;charset=UTF-8` con BOM, en streaming por *keyset* en lotes de 1 000, hasta 50 000 filas.
  - Protegido contra inyección de fórmulas: todas las celdas van entre comillas y se antepone `'` a `= + - @ TAB CR`. Por eso `@admin` aparece como `'@admin`.

### Retención recomendada (pendiente: es tarea del DBA)

Volumen estimado: entre 5 y 20 eventos por usuario activo y día, es decir, de 5 a 35 GB al año con 5 000 usuarios. Es una estimación, no una medición.

1. **En línea, 13 meses** en PostgreSQL.
2. **Archivo frío, 5 años** (o lo que exija la normativa): un export mensual comprimido con SHA-256 a un almacenamiento inmutable fuera de la BD.
3. **Purga:** el proyecto **no incluye ninguna herramienta de purga**. La bitácora es append-only por trigger, así que un `DELETE` normal falla con `RB403`. Purgar eventos antiguos es tarea del DBA, que tiene dos caminos:
   - desactivar el trigger temporalmente, dentro de una transacción y en una ventana de mantenimiento: `ALTER TABLE bitacora.auditoria_eventos DISABLE TRIGGER trg_auditoria_solo_insercion;`, el `DELETE … WHERE ocurrido_en < …` y `ENABLE TRIGGER` de nuevo;
   - o usar un rol dedicado de mantenimiento, distinto del de la app, para esa operación.

   La tabla **no está particionada** (`bitacora.asegurar_particiones_bitacora()` existe solo por compatibilidad y no hace nada). Si el volumen lo exige, particionar por mes es una evolución pendiente.
4. `ocurrido_en` es `TIMESTAMPTZ`, sin el límite de 2038 que tenía el `TIMESTAMP` de MySQL.

---

## 5. Estructura del repositorio

```
.
├── Dockerfile                 # Imagen única: build Angular + build Spring + runtime nginx/supervisord
├── .dockerignore              # Excluye .env*, *.sql, certs, .git, etc.
├── render.yaml                # Blueprint de Render (servicio web Docker + Render PostgreSQL hehiachi-mishima-db)
├── docker-compose.yml         # Misma imagen en local; perfil opcional "db-local"
├── .github/workflows/ci.yml   # mvn verify (Testcontainers) + ng build + docker build + smoke
├── deploy/
│   ├── entrypoint.sh          # Valida env, genera config nginx/real_ip, truststore de la CA, exec supervisord
│   ├── supervisord.conf       # Arranque backend→nginx; parada nginx→backend
│   ├── supervisor-fatal-listener.sh
│   ├── run-backend.sh, run-nginx.sh
│   ├── csp-hashes.mjs         # Hashes CSP de <script> inline del index compilado
│   └── nginx/                 # nginx.conf, default.conf, cabeceras, proxy
├── backend/
│   ├── .env.example           # Plantilla de variables (copiar a .env; .env no se versiona)
│   ├── schema.sql             # ÚNICO script de BD: schemas comun, seguridad y bitacora, triggers y seed (se aplica con psql)
│   ├── informe-rendimiento.md # Informe de rendimiento de la migración a PostgreSQL (antes/después)
│   ├── pom.xml, mvnw
│   └── src/
│       ├── main/java/oracle/
│       │   ├── auth/          # Login, sesión, contraseña, JWT
│       │   ├── admin/         # controller · service (GuardiaPrivilegios, Protecciones…) · repository · model · request · response
│       │   ├── auditoria/     # Bitácora: escritor, consulta, CSV, catálogo
│       │   └── common/        # config, security, validation, web, support
│       ├── main/resources/    # application.properties, application-prod.properties
│       └── test/java/oracle/  # soporte/ (Testcontainers) + api/ (suite de integración)
└── frontend/
    ├── angular.json, package.json
    └── src/
        ├── environments/      # apiUrl: '/api' (prod) · 'http://localhost:2003/api' (desarrollo)
        ├── styles/            # Sistema «consola plana»: _design.scss, tokens/, themes/ (claro y oscuro), mixins/, base/, components/
        └── app/
            ├── core/          # config (permisos, auditoria, protecciones, configuracion), guards, interceptors, services, models
            ├── paneles/       # registro.ts (PANELES), panel.model.ts, panel-actual.ts
            │   └── administracion/
            │       ├── administracion.panel.ts   # grupos y módulos del panel
            │       └── modulos/                   # resumen/, auditoria/, usuarios/, roles/, permisos/
            ├── layout/        # PanelShell (shell genérico de panel), portal/ (selector de paneles), paleta-modulos (Ctrl/⌘K), sin-acceso
            ├── features/      # fuera de los paneles: auth/login, cuenta (menú, cambiar contraseña, aviso de sesión)
            └── shared/        # ui (modal, toast, paginador, historial, charts…), forms, pipes, directives
    ├── public/                # logo.png, logoImg.png (Geist y Geist Mono llegan vía @fontsource-variable)
    └── DESIGN-HANDOFF.md      # Especificación del rediseño «consola plana»
```

---

## 6. Requisitos

| Para | Necesitas |
|---|---|
| Backend sin Docker | Java 25 (usa el wrapper `./mvnw`, no hace falta Maven instalado) |
| Frontend | Node 24 y npm (la versión de CI y del Dockerfile) |
| Pruebas del backend | Docker en marcha (Testcontainers levanta `postgres:17-alpine`) |
| Imagen y compose | Docker con BuildKit |
| Base de datos | PostgreSQL 15 o superior; probado con 17. Necesita soporte ICU (colación `comun.ci`) y la extensión `pg_trgm` (el script la crea si no existe) |
| Aplicar el esquema | Cliente `psql` |

---

## 7. Configuración (variables de entorno)

- **Local:** copia la plantilla con `cp backend/.env.example backend/.env` y completa los valores. El backend lee `.env` desde su **directorio de trabajo**, así que hay que arrancarlo desde `backend/`. `.env` está en `.gitignore` y `.dockerignore`: nunca entra en el repositorio ni en la imagen.
- **Render:** las variables se inyectan desde el dashboard. Las marcadas `sync: false` en `render.yaml` se piden al crear el Blueprint.
- **docker compose:** usa `env_file: backend/.env`.

### Obligatorias

| Variable | Ejemplo / valor | Uso |
|---|---|---|
| `DB_CONEXION` + bloque `DB_<NOMBRE>_*` | `NUBE` → `DB_NUBE_HOST`, `DB_NUBE_PORT` (5432), `DB_NUBE_NAME`, `DB_NUBE_USER`, `DB_NUBE_PASSWORD`, `DB_NUBE_SSLMODE`, `DB_NUBE_POOL`, `DB_NUBE_STATEMENT_TIMEOUT_MS` | Conexión PostgreSQL. `DB_CONEXION` elige qué bloque se usa (p. ej. `NUBE` o `LOCAL`). En lugar de los campos sueltos, un bloque acepta una sola `DB_<NOMBRE>_URL=postgresql://usuario:clave@host:5432/base`. `schema.sql` no crea la base: créala antes (o usa la de Render) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | `dpg-xxx`, `5432`, `hehiachi_mishima`, … | Alternativa directa al bloque. Si están definidas, **siempre ganan** sobre `DB_CONEXION`. En Render se inyectan desde la BD con `fromDatabase` |
| `JWT_SECRET` | `openssl rand -hex 32` | Firma HS256, mínimo 32 caracteres. Render la genera (`generateValue`) |
| `USER_ADMIN`, `USER_PASSWORD`, `USER_NAME`, `USER_LASTNAME`, `USER_EMAIL`, `USER_PHONE` | `@admin`, … | Administrador semilla: se crea al arrancar si no existe. La contraseña debe cumplir la política (12 caracteres o más, con letras y números) |
| `SPRING_PROFILES_ACTIVE` | `prod` | Ya viene fijada en el Dockerfile y en `render.yaml`. Déjala sin definir para desarrollo local |

### Opcionales

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `10000` | Puerto público (nginx). Render lo inyecta |
| `BACKEND_PORT` | `2003` | Puerto interno de Spring (solo `127.0.0.1` en el contenedor). Debe ser **distinto** de `PORT`: si coinciden, el entrypoint aborta |
| `DB_SSLMODE` | `prefer` | `sslmode` del driver JDBC (`disable`, `prefer`, `require`, `verify-full`). En la red privada de Render basta `prefer`; desde fuera, `require` o `verify-full` |
| `DB_POOL` | `20` (`5` en `render.yaml`) | Pool Hikari fijo (mínimo = máximo) por instancia |
| `DB_STATEMENT_TIMEOUT_MS` | `15000` | `statement_timeout` de cada conexión: una consulta desbocada no retiene la conexión |
| `DB_POOL_TIMEOUT_MS` / `DB_POOL_MAX_LIFETIME_MS` | 5000 / 1500000 | Hikari (solo perfil prod) |
| `JWT_ISSUER` | `hehiachi-mishima` | Claim `iss` |
| `JWT_EXPIRATION_MS` | `900000` (15 min); `3600000` (1 h) en `render.yaml` | Vida del token |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` | Lista separada por comas. En Render, la URL pública del servicio |
| `USER_ACTIVO` / `USER_ROL` | `TRUE` / `ADMINISTRADOR` | Estado y rol del usuario semilla |
| `BCRYPT_COSTE` | `10` | Cada +1 duplica el coste del login. Con 0,1 CPU, 12 tarda ~1 s por login y amplifica un DoS |
| `LOGIN_BLOQUEO_UMBRAL` / `LOGIN_BLOQUEO_MAX_MINUTOS` | `5` / `60` | Bloqueo por cuenta |
| `USUARIOS_PROTEGIDOS` | vacío | Usuarios protegidos además de `@hehiachi` y `USER_ADMIN` (lista separada por comas) |
| `AUDITORIA_CAPACIDAD_COLA` | `10000` | Eventos en cola antes de descartar |
| `ANALITICA_CACHE_TTL_MS` / `ANALITICA_PARALELISMO` | `120000` / 4 (2 en prod) | Caché y paralelismo del dashboard. El paralelismo debe quedar por debajo del pool |
| `APP_ZONA_HORARIA` | `America/Lima` | Zona de la JVM. La BD y la bitácora siempre trabajan en UTC (ver [§14](#14-riesgos-y-pendientes-conocidos)) |
| `JAVA_OPTS` | ver Dockerfile | JVM para 512 MB: `MaxRAMPercentage=50`, `SerialGC`, `ExitOnOutOfMemoryError`… Con 2 GB o más, usa `MaxRAMPercentage=70` y G1 |
| `NGINX_WORKER_PROCESSES` | `1` | `auto` en planes grandes |
| `REAL_IP_FROM` | rangos privados | CIDR de los proxies de confianza para `real_ip` |
| `REAL_IP_HEADER` | `X-Forwarded-For` | Alternativas: `CF-Connecting-IP`, `True-Client-IP`, `X-Real-IP` |

---

## 8. Base de datos

La BD **no** va en la imagen: es un PostgreSQL externo (en Render, la base `hehiachi-mishima-db` declarada en `render.yaml`). Todo el esquema está en **un único archivo**, `backend/schema.sql`, que se aplica **a mano** con `psql`. No hay Flyway, ni carpeta de migraciones, ni `ddl-auto` (`spring.jpa.hibernate.ddl-auto=none`): la aplicación nunca crea ni altera tablas.

| Schema | Contenido |
|---|---|
| `comun` | Colación ICU `comun.ci` (sin distinguir mayúsculas ni tildes), `comun.proteger()` (lanza `SQLSTATE 'RB403'`) y el trigger genérico `comun.fijar_actualizado_en()` |
| `seguridad` | Tablas `usuarios`, `roles`, `permisos`, `roles_permisos`, `usuarios_roles`, `usuarios_permisos` y `sesiones_refresh`; vistas `v_permisos_efectivos` y `v_permisos_finales` (deny-wins con `bool_and`); función `permisos_de()`; triggers de protección de ADMINISTRADOR, de los permisos base y de los usuarios protegidos por nombre (`@admin` y `@hehiachi`) |
| `bitacora` | `auditoria_eventos` append-only: `UPDATE`, `DELETE` y `TRUNCATE` bloqueados por trigger (ver [§4](#4-bitácora-de-auditoría)) |

El script también crea la extensión `pg_trgm` y siembra el rol ADMINISTRADOR y los 17 permisos base (incluido `VER_AUDITORIA`). Todo corre en una sola transacción (`BEGIN … COMMIT`).

- **Unicidad sin mayúsculas ni tildes:** índices únicos sobre `(columna COLLATE comun.ci)`, p. ej. `uq_usuarios_usuario` y `uq_usuarios_email`.
- **Búsquedas `ILIKE '%texto%'`:** índices GIN `pg_trgm` (p. ej. `idx_usuarios_busqueda_trgm`).
- **Errores de protección:** los triggers lanzan `SQLSTATE 'RB403'` y el backend (`GlobalExceptionHandler`) lo traduce a HTTP 403, que además queda en la bitácora como `ACCESO_DENEGADO`.
- **Resolución de schemas:** la URL JDBC usa `currentSchema=seguridad,comun,bitacora,public` (`application.properties`), así que las entidades JPA no califican el schema.

### Instalación nueva

La base de datos debe existir (el script no ejecuta `CREATE DATABASE`). Después:

```bash
psql "postgresql://usuario:clave@host:5432/base" -v ON_ERROR_STOP=1 -f backend/schema.sql
```

### Re-ejecutar el script (BD existente)

> **Cuidado: re-ejecutar `schema.sql` destruye los datos de usuarios, roles y permisos.** El script empieza con `DROP SCHEMA IF EXISTS seguridad CASCADE` y `DROP SCHEMA IF EXISTS comun CASCADE`, y los recrea desde cero con el seed inicial.

- El schema `bitacora` **se conserva**: usa `CREATE … IF NOT EXISTS` y `CREATE OR REPLACE`, así que los eventos de auditoría sobreviven y solo se crean los objetos que falten o se refrescan funciones y triggers.
- El administrador semilla (`USER_ADMIN`) se vuelve a crear al arrancar la app, pero el resto de usuarios, roles, asignaciones y overrides se pierden. Haz un `pg_dump` antes si hay datos que conservar.
- Hazlo en una ventana de mantenimiento y con la app detenida.

### GRANT recomendado

Crea un rol de aplicación **sin superusuario** y que **no sea el dueño** de las tablas (el dueño puede desactivar triggers). Aplica `schema.sql` con otro rol (el dueño) y concede a la app solo lo necesario. Ejemplo, con la app como `app_rol`:

```sql
CREATE ROLE app_rol LOGIN PASSWORD '…' NOSUPERUSER NOCREATEDB NOCREATEROLE;

GRANT USAGE ON SCHEMA seguridad, comun, bitacora TO app_rol;

-- RBAC: lectura y escritura normales.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA seguridad TO app_rol;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA seguridad TO app_rol;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA seguridad, comun, bitacora TO app_rol;

-- Bitácora: solo lectura e inserción.
GRANT SELECT, INSERT ON bitacora.auditoria_eventos TO app_rol;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bitacora TO app_rol;
REVOKE TRUNCATE, UPDATE, DELETE ON bitacora.auditoria_eventos FROM app_rol;
```

Como `schema.sql` recrea `seguridad` y `comun` en cada ejecución, vuelve a aplicar estos `GRANT` después de re-ejecutarlo. En Render, el usuario que crea `render.yaml` (`hehiachi`) es el dueño de la base; si quieres esta separación, crea el rol de aplicación aparte y apunta `DB_USER`/`DB_PASSWORD` a él.

### Notas

- En PostgreSQL, los borrados en cascada (`ON DELETE CASCADE`) **sí** disparan los triggers de las tablas hijas. Borrar un permiso no base elimina también sus asignaciones, incluidas las de ADMINISTRADOR: `trg_roles_permisos_proteger` lo permite a propósito cuando el permiso mismo se está eliminando.
- La lista de permisos base está repetida en varios sitios. Al añadir uno, cámbialos todos (ver [§15](#15-cómo-usar-esta-base-para-un-sistema-nuevo)).

---

## 9. Desarrollo local

### Opción A: backend y frontend sin Docker (recomendada para programar)

Necesitas un PostgreSQL accesible con el esquema aplicado ([§8](#8-base-de-datos)) y `backend/.env` con el bloque local (`DB_CONEXION=LOCAL` y `DB_LOCAL_*`).

```bash
# Backend: API en http://localhost:2003/api (perfil por defecto, sin "prod")
cd backend
./mvnw spring-boot:run

# Frontend: SPA en http://localhost:4200 (usa environment.development.ts → localhost:2003)
cd frontend
npm install
npm start
```

### Opción B: la misma imagen de producción, contra la BD de `backend/.env`

```bash
docker compose up --build                 # http://localhost:10000
curl -i http://localhost:10000/api/health # 204
```

### Opción C: imagen + PostgreSQL 17 local (perfil `db-local`)

```bash
docker compose --profile db-local up --build postgres app-db-local   # app en http://localhost:10001
docker compose exec postgres psql -U app hehiachi_mishima            # consola SQL (opcional)
```

- El servicio `postgres` (`postgres:17-alpine`) publica el puerto en `127.0.0.1:5433`.
- `schema.sql` se aplica solo, vía `/docker-entrypoint-initdb.d`, **únicamente al crear el volumen**. Para reaplicarlo, borra el volumen (`docker compose --profile db-local down -v`) o ejecútalo con `psql` contra `localhost:5433`.
- `app-db-local` se conecta a ese contenedor con variables `DB_*` directas, que ganan sobre `DB_CONEXION`.

Las opciones B y C también necesitan `backend/.env`, que se usa para `JWT_SECRET` y `USER_*`.

---

## 10. Pruebas

```bash
cd backend
./mvnw -B verify                              # suite completa (necesita Docker); ~1-2 min
./mvnw -B test -Dtest=AuditoriaTest           # una clase
```

No necesitan `.env`: los tests fijan sus propias propiedades. Testcontainers levanta `postgres:17-alpine` con `backend/schema.sql` como script de inicio, y Ryuk lo elimina al terminar. Resultado actual: **264 tests, 263 pasan y 1 se omite** (la prueba de carga).

| Clase | Tests | Cubre |
|---|---|---|
| `MatrizAutorizacionTest` | 185 | Generada desde los `@PreAuthorize` de los 48 endpoints `/api/**`: sin token → 401, sin permiso → 403, con exactamente los permisos declarados → OK, ADMINISTRADOR → OK. **Rompe la build si un endpoint nuevo no tiene `@PreAuthorize`** |
| `AutenticacionTest` | 23 | Login, bloqueo por cuenta, 429, validación del JWT (firma, `alg:none`, expiración, `iss`, `ver`) y revocación |
| `EscaladaPrivilegiosTest` | 19 | Escaladas P0-1/2/3, nombres reservados, cruce usuario↔email y BUG-2 |
| `ProteccionesTest` | 11 | ADMINISTRADOR, permisos base, `@hehiachi` (también a nivel de BD), usuario semilla, `USUARIOS_PROTEGIDOS` y flag `protegido` |
| `AuditoriaTest` | 11 | Eventos, filtros, `relacionadoCon`, paginación, CSV anti-fórmulas, append-only y `X-Request-Id` |
| `CrudTest` | 8 | CRUD, asignaciones, deny-wins con efecto inmediato, resumen y analítica |
| `ValidacionTest` | 5 | 400 con `campos`, contraseñas de más de 72 bytes y 404/405/415: nunca 500 |
| `BackendApplicationTests` | 1 | Arranque del contexto contra PostgreSQL real |
| `CargaTest` | 1 | Carga y concurrencia: **opt-in, omitido por defecto** |

### Prueba de carga (opt-in)

```bash
./mvnw -B test -Dtest=CargaTest -Dcarga=true -Dpruebas.bcrypt-coste=10 -Dsurefire.failIfNoSpecifiedTests=false
# -Dcarga.n=500 para cambiar la concurrencia; informe en backend/target/carga-informe.txt
```

Resultados orientativos con 200 peticiones simultáneas por escenario. App, cliente y PostgreSQL 17 (Testcontainers) corrían en la misma máquina de 6 CPU, con el pool Hikari fijo de 20. Son los valores «después» de la sección 6 de `backend/informe-rendimiento.md`, que tiene el detalle y la comparación antes/después:

| Escenario | p95 |
|---|---|
| `GET /api/usuarios/{id}` | 239 ms |
| `GET /api/roles` | 236 ms |
| `GET /api/auditoria` (página de 25) | 352 ms |
| `POST /api/auth/login` (BCrypt 10) | 4 882 ms |

Hubo 0 logins con error, 0 timeouts de conexión de Hikari y 0 pruebas de búsqueda fallidas. El objetivo de **p95 < 200 ms no se cumple** con ráfagas de 200 simultáneas en esa máquina. El login está limitado por CPU (BCrypt): en Render con 0,1 CPU se estiman unos 2 logins por segundo. Las cifras de la bitácora se midieron con un esquema anterior (particionado), así que conviene repetirlas. Falta repetir la prueba con k6 en un entorno aislado con la configuración de prod.

### Frontend

```bash
cd frontend && npx ng build   # build de producción (lo que valida el CI)
```

---

## 11. Despliegue en Render

### Paso a paso

1. **Sube el repo** a GitHub. `render.yaml` despliega la rama `hehiachi_mishima`, que hoy es la única en `origin`. Si creas `main`, cambia `branch` en `render.yaml`. El CI ya escucha las dos.
2. En Render, ve a **New + → Blueprint** y selecciona el repositorio. Se crean el servicio web Docker (`hehiachi-mishima`) y la base **Render PostgreSQL** `hehiachi-mishima-db` (PostgreSQL 17, misma región). `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` se inyectan solas desde esa base con `fromDatabase`.
3. **Completa las variables `sync: false`:** `USER_ADMIN`, `USER_PASSWORD`, `USER_NAME`, `USER_LASTNAME`, `USER_EMAIL` y `USER_PHONE`.

   `JWT_SECRET` lo genera Render. Ajusta `CORS_ALLOWED_ORIGINS` si la URL o el dominio cambian.
4. **Aplica el esquema una vez** ([§8](#8-base-de-datos)), antes de que el servicio arranque contra la base: copia la *External Database URL* de `hehiachi-mishima-db` en el dashboard y ejecuta:

   ```bash
   psql "postgresql://usuario:clave@host:5432/base" -v ON_ERROR_STOP=1 -f backend/schema.sql
   ```

   Si el primer deploy se adelantó y falló por falta de tablas, lanza un *Manual Deploy* después de aplicar el script. Opcionalmente, crea un rol de aplicación con el [GRANT recomendado](#grant-recomendado). No vuelvas a ejecutar `schema.sql` sobre una base con datos: borra usuarios, roles y permisos.
5. **Primer despliegue.** El primer build tarda, porque compila npm y Maven sin caché. En el plan free (0,1 CPU) el arranque puede llevar de 60 a 120 s, y Render espera a que `/api/health` responda.
   - Si la BD no es accesible, el backend falla, supervisord lo reintenta 5 veces y después apaga el contenedor. El deploy queda **fallido**, no en verde sin API: es el comportamiento buscado.
6. **Opcional:** cambia a `autoDeployTrigger: checksPass` para desplegar solo cuando pase el CI.

### Checklist post-deploy

- [ ] `curl -i https://<servicio>.onrender.com/api/health` → `204`.
- [ ] `curl -I https://<servicio>.onrender.com/` muestra `Content-Security-Policy`, `Strict-Transport-Security` y `X-Request-Id`.
- [ ] **IP real del cliente:** inicia sesión y comprueba el campo `ip` del log JSON de nginx y del evento `LOGIN_EXITOSO` en Auditoría.
  - Si aparece una IP del proxy y no la tuya, ajusta `REAL_IP_HEADER` (p. ej. `CF-Connecting-IP`) o `REAL_IP_FROM`.
  - Sin esto, el limitador por IP agrupa a todos los usuarios en el mismo cubo y la columna `ip` de la bitácora no sirve.
- [ ] **Re-login único:** todos los JWT emitidos antes de esta versión quedan inválidos, porque no llevan el claim `ver`. Avisa a los usuarios: verán «Tu sesión se cerró» una sola vez.
- [ ] **Rota secretos.** Rota `JWT_SECRET` si se ha expuesto alguna vez. Rotarlo cierra todas las sesiones y cambia la huella de los `LOGIN_FALLIDO` futuros. Usa contraseñas propias para la BD y el usuario semilla: `backend/.env.example` deja esos valores vacíos.
- [ ] `/actuator/env` y `/actuator/prometheus` → `404`.
- [ ] En el plan free, el servicio se suspende tras 15 min de inactividad y tarda en reactivarse. Si no es aceptable, usa `starter` o un plan superior.

---

## 12. Referencia de API

Base: `/api`. Todas las rutas, salvo login y health, requieren `Authorization: Bearer <token>`. «A + B» significa que hacen falta **ambos** permisos.

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| POST | `/api/auth/login` | público | `{usuario, contrasena}` → `AuthResponse {token, tipo, expiraEn, usuario, permisos}`. 401 genérico; 429 con `Retry-After` |
| GET | `/api/auth/sesion` | autenticado | Usuario y permisos actuales |
| PUT | `/api/auth/contrasena` | autenticado | `{contrasenaActual, contrasenaNueva}` → `AuthResponse` con **token nuevo**. Revoca los anteriores |
| GET | `/api/health` | público | 204, sin consultar la BD |
| GET | `/api/usuarios`, `/api/usuarios/buscar`, `/api/usuarios/{id}` | `VER_USUARIOS` | Filtros de búsqueda: `usuario`, `nombre`, `apellido`, `email`, `activo` |
| GET | `/api/usuarios/resumen` | `VER_USUARIOS` + `VER_ROLES` + `VER_PERMISOS` | `?ids=1,2,3` (máximo 500) → roles y permisos por usuario |
| POST | `/api/usuarios` | `CREAR_USUARIOS` | Contraseña según la política |
| PUT | `/api/usuarios/{id}` | `MODIFICAR_USUARIOS` | Actualización parcial |
| PATCH | `/api/usuarios/{id}/activo` | `MODIFICAR_USUARIOS` | `{activo, motivo?}` |
| DELETE | `/api/usuarios/{id}` | `ELIMINAR_USUARIOS` | |
| GET | `/api/usuarios/{id}/roles` | `VER_USUARIOS` + `VER_ROLES` | |
| POST | `/api/usuarios/{id}/roles` | `ASIGNAR_ROLES` | `{rolId}` |
| DELETE | `/api/usuarios/{id}/roles/{rolId}` | `ASIGNAR_ROLES` | |
| GET | `/api/roles/{id}/usuarios` | `VER_ROLES` + `VER_USUARIOS` | |
| GET | `/api/usuarios/{id}/permisos`, `…/denegados`, `…/con-override` | `VER_USUARIOS` + `VER_PERMISOS` | Overrides del usuario |
| PUT | `/api/usuarios/{id}/permisos` | `ASIGNAR_PERMISOS` | `{permisoId, otorgado}`: grant (`true`) o deny (`false`) |
| DELETE | `/api/usuarios/{id}/permisos/{permisoId}` | `ASIGNAR_PERMISOS` | Quita el override (vuelve a heredar) |
| GET | `/api/roles`, `/api/roles/buscar`, `/api/roles/{id}` | `VER_ROLES` | |
| POST · PUT · DELETE | `/api/roles[/{id}]` | `CREAR_ROLES` · `MODIFICAR_ROLES` · `ELIMINAR_ROLES` | |
| PATCH | `/api/roles/{id}/activo` | `MODIFICAR_ROLES` | `{activo, motivo?}` |
| GET | `/api/roles/{id}/permisos` | `VER_ROLES` + `VER_PERMISOS` | |
| POST | `/api/roles/{id}/permisos` | `ASIGNAR_PERMISOS` | `{permisoId}` |
| DELETE | `/api/roles/{id}/permisos/{permisoId}` | `ASIGNAR_PERMISOS` | |
| GET | `/api/permisos`, `/api/permisos/buscar`, `/api/permisos/{id}` | `VER_PERMISOS` | |
| POST · PUT · DELETE | `/api/permisos[/{id}]` | `CREAR_PERMISOS` · `MODIFICAR_PERMISOS` · `ELIMINAR_PERMISOS` | |
| PATCH | `/api/permisos/{id}/activo` | `MODIFICAR_PERMISOS` | `{activo, motivo?}` |
| GET | `/api/permisos/{id}/roles` | `VER_ROLES` | Roles que conceden el permiso |
| GET | `/api/resolucion/usuarios/{id}/efectivos` | `VER_USUARIOS` + `VER_PERMISOS` | Filas `ROL` (con `roles[]`) y `OVERRIDE` |
| GET | `/api/resolucion/usuarios/{id}/finales`, `…/permitidos`, `…/{permisoId}/tiene` | `VER_USUARIOS` + `VER_PERMISOS` | Resultado deny-wins |
| GET | `/api/admin/analitica` | `DASHBOARD_ADMIN` | KPIs y series del dashboard (caché de 2 min) |
| GET | `/api/auditoria` | `VER_AUDITORIA` | Ver [§4](#api-todo-con-ver_auditoria) |
| GET | `/api/auditoria/{id}`, `/api/auditoria/catalogo` | `VER_AUDITORIA` | |
| GET | `/api/auditoria/exportar` | `VER_AUDITORIA` | CSV de hasta 50 000 filas |

Las respuestas de usuario, rol y permiso incluyen `protegido: boolean`. En usuario también vale `true` para la propia cuenta.

---

## 13. Accesibilidad

**Estado:** la auditoría WCAG 2.2 AA inicial (estática, sobre el código) dio **«No conforme»**, con 2 hallazgos críticos, 10 serios, 12 moderados y 10 menores. Se aplicaron las correcciones de los críticos, de los serios y de la mayoría de moderados y menores:

- formularios con `id`/`for`, `aria-invalid`, `aria-describedby` y `autocomplete`;
- foco al primer campo inválido;
- switches con `role="switch"` y nombre accesible;
- selector Heredar/Conceder/Denegar con `aria-pressed` y un indicador que no depende del color;
- toasts que se pausan con el puntero o el foco, y errores que no desaparecen solos;
- live regions persistentes (`Anunciador`);
- foco visible con outline de contraste ≥ 3:1 y bloque `forced-colors`;
- título por ruta y skip link;
- foco al `h1` al cambiar de ruta;
- modales con `aria-labelledby` y `alertdialog`, y retorno del foco;
- barra lateral `inert` en móvil;
- redimensionado de columnas por teclado;
- aviso antes de que expire la sesión.

**Verificado:** el contraste de los tokens finales (92 pares OK, 0 fallos) y que no hay scroll horizontal de página a 360, 390, 768, 1024, 1280, 1440 y 1920 px, en tema claro y oscuro. La comprobación se hizo con un mock del API.

**No probado:**
- lectores de pantalla reales (VoiceOver o NVDA);
- axe/Lighthouse;
- zoom al 400 % y reflow a 320 px;
- modo `forced-colors` real;
- animaciones con el panel visible;
- la semántica de tabla en el modo tarjeta (< 768 px) con lectores de pantalla; Safari antiguo podría necesitar roles ARIA explícitos;
- Safari, Firefox y dispositivos reales con notch;
- la página «Sin acceso».

**No se puede afirmar conformidad WCAG** hasta completar esa re-auditoría. Siguiente paso recomendado: `@axe-core/playwright` en el CI y una sesión manual con VoiceOver + Safari y NVDA + Firefox.

---

## 14. Riesgos y pendientes conocidos

Prioridad: **P1** = antes de producción con usuarios reales o en la primera iteración; **P2** = planificar; **P3** = mejora.

| Prio | Riesgo / pendiente | Detalle y mitigación actual |
|---|---|---|
| P1 | IP real en Render sin verificar | El limitador por IP y la columna `ip` de la bitácora dependen de ella. Compruébala en el checklist post-deploy |
| P1 | Limitador de login en memoria | Se pierde al reiniciar y no se comparte entre nodos. Lo mitigan el bloqueo por cuenta, persistido en la BD, y el `limit_req` de nginx. Con más de un nodo hará falta un almacén compartido (p. ej. Redis) |
| P1 | Sin logout en el servidor | Un token robado vale hasta su expiración (1 h). Implementarlo es sencillo: `POST /api/auth/logout` que incremente `credenciales_version`. No funcionaría para `@hehiachi`, porque su trigger bloquea esa columna |
| P1 | Rendimiento bajo carga sin validar | El p95 < 200 ms no se cumple en ráfagas de 200 concurrentes (medición local en una máquina cargada). El login con 0,1 CPU dará unos 2 por segundo. Hay que repetirlo con k6 en un entorno dedicado con el pool de prod |
| P1 | Privilegios del usuario de BD | Los triggers bloquean `UPDATE`, `DELETE` y `TRUNCATE` en la bitácora, pero si la app conecta como dueño de las tablas o como superusuario puede desactivarlos o hacer `DROP`. En Render, por defecto, la app usa el usuario dueño de la base. Aplica el [GRANT recomendado](#grant-recomendado) |
| P1 | Re-ejecutar `schema.sql` borra datos | Hace `DROP SCHEMA … CASCADE` de `seguridad` y `comun`: se pierden usuarios, roles, permisos y asignaciones (la bitácora se conserva). Haz `pg_dump` antes (ver [§8](#8-base-de-datos)) |
| P2 | Retención de `auditoria_eventos` sin implementar | Plan en [§4](#retención-recomendada-pendiente-es-tarea-del-dba). La purga es tarea manual del DBA y la tabla no está particionada |
| P2 | La tabla de Usuarios no pagina en el servidor | La lista se carga completa (tope de 5 000) y se filtra en el cliente. Solo el resumen va por página. Con miles de usuarios conviene usar `/usuarios/buscar` con `PaginaResponse` |
| P2 | Pérdida de eventos de auditoría | La cola está en memoria: si se llena, o el proceso muere sin vaciarla en 5 s, se pierden eventos, cada uno con su log `ERROR`. Las métricas no se exponen en prod |
| P2 | Lectores de pantalla y axe no probados | Ver [§13](#13-accesibilidad) |
| P2 | Acciones de GitHub fijadas por tag mayor | Fijarlas por SHA y activar Dependabot. El workflow aún no se ha ejecutado en GitHub |
| P2 | Fechas sin zona | Las respuestas de usuarios, roles y permisos serializan `LocalDateTime` en hora de Lima, mientras la bitácora usa UTC con `Z`. Pasar a `OffsetDateTime` requiere coordinar frontend y backend |
| P2 | El usuario semilla está protegido solo en la app | Si se añade al trigger de la BD, no podrá cambiar su contraseña. Es una decisión consciente |
| P3 | Tablas en móvil | Se desplazan en horizontal dentro de la tarjeta (permitido por WCAG 1.4.10 para tablas de datos). Falta una vista de tarjetas por fila |
| P3 | Huecos de UX | No hay filtro «Con ajustes individuales» en Usuarios, agrupación de permisos por dominio, selector de densidad, tendencia (▲/▼) en los KPIs ni multiselección de acción en Auditoría |
| P3 | `style-src 'unsafe-inline'` en la CSP | Lo necesita Angular para los estilos de componentes. Quitarlo exige un nonce por petición |
| P3 | `@Valid` se evalúa antes que `@PreAuthorize` | Un usuario sin permiso que envía un cuerpo inválido recibe 400 con `campos`, lo que revela el esquema del DTO |
| P3 | Sabotaje por desactivación | Quien tiene `MODIFICAR_ROLES` o `MODIFICAR_PERMISOS` puede desactivar roles o permisos no protegidos que usan otros. No es una escalada y queda auditado |
| P3 | Avisos de Lombok con Java 25 (`sun.misc.Unsafe`) | Vienen del procesador de anotaciones. Se silencian con `--sun-misc-unsafe-memory-access=allow` en `backend/.mvn/jvm.config` |

---

## 15. Cómo usar esta base para un sistema nuevo

### Renombrar el proyecto

Busca y sustituye `hehiachi_mishima` / `hehiachi-mishima` en estos sitios:
- `render.yaml`: nombre del servicio, rama, `JWT_ISSUER`, `CORS_ALLOWED_ORIGINS` y la base declarada en `databases` (`hehiachi-mishima-db`, `databaseName`) junto con sus referencias `fromDatabase`;
- `docker-compose.yml`;
- `application.properties` (`app.jwt.issuer` y `ApplicationName` de la URL JDBC);
- `application-prod.properties` (`logging.structured.ecs.service.name`).

Revisa también `@hehiachi` (`Protecciones.USUARIO_RAIZ` y la función `seguridad.es_usuario_protegido` de `schema.sql`) si quieres otro usuario raíz.

### Añadir un permiso

1. **BD:** no hay migraciones. En una base con datos, inserta el permiso con `POST /api/permisos` o con un `INSERT INTO seguridad.permisos …` ejecutado a mano con `psql`; para instalaciones nuevas, añádelo también al seed de `schema.sql`. En todos los casos, el trigger `trg_permisos_conceder_admin` se lo asigna a ADMINISTRADOR.
2. **Si debe ser permiso base** (no editable ni eliminable), añádelo a la lista en **estos sitios**:
   - `Protecciones.PERMISOS_BASE`;
   - la función `seguridad.es_permiso_base` y el seed de `schema.sql`. En una base existente, aplica a mano un `CREATE OR REPLACE FUNCTION seguridad.es_permiso_base …` con la lista nueva: no re-ejecutes el script completo, porque borra los datos ([§8](#8-base-de-datos)).
3. **Frontend:** añádelo a `PERMISOS` en `frontend/src/app/core/config/permisos.ts`.

### Añadir un módulo (pantalla + API)

1. **Backend:**
   - Crea el controlador en `oracle.<modulo>.controller` con `@PreAuthorize("hasAuthority('X')")` en **cada** endpoint. Usa solo `hasAuthority(..)`, combinado con `and` si hace falta.
   - `MatrizAutorizacionTest` lo detecta solo: rompe la build si falta la protección o si un `@RequestBody` nuevo no tiene cuerpo de ejemplo. Añade ese cuerpo en el test.
   - Sigue el patrón existente: el controlador es síncrono y devuelve `ApiResponse<T>` (sin Reactor; cada petición corre en un hilo virtual), y las transacciones van con `transacciones.ejecutar`. El trabajo de CPU intensivo, como BCrypt, va a un pool acotado de hilos de plataforma (ver `CodificacionContrasenas`).
   - Para filtros de búsqueda opcionales, usa `Specification` dinámicas de JPA (`Especificaciones`) en lugar de consultas con parámetros `IS NULL OR …`.
   - Si el módulo necesita tablas nuevas, añádelas a `schema.sql` (en el schema que corresponda) y aplica el DDL a mano en las bases existentes.
   - Los listados se acotan con `Listas.limitado` o se paginan con `PaginaResponse`.
   - Si el módulo concede o retira privilegios, usa `GuardiaPrivilegios`.
2. **Auditoría:**
   - Añade las acciones a `AccionAuditoria` (y a `EntidadAuditoria` si hay una entidad nueva).
   - Registra con `RegistroAuditoria.exito(...)` o `registrar(...)`, usando un `ContextoAuditoria` capturado en el hilo de la petición y los helpers de `Detalle` (`{antes, despues}` o `{motivo}`). Nunca guardes secretos en `detalle`.
   - Añade las etiquetas legibles en `frontend/src/app/core/config/auditoria.ts`.
3. **Frontend** (los pasos detallados están en la cabecera de `src/app/paneles/registro.ts`):
   - Crea la carpeta `src/app/paneles/<panel>/modulos/<id>/` con su página standalone y sus subcomponentes.
   - Añade una entrada a `modulos` en `<panel>.panel.ts` con `id` (único en toda la app), `nombre`, `descripcion`, `icono`, `ruta`, `permiso`, `grupo` y `cargar` (o `hijos` si tiene subrutas).
   - Para conocer el panel desde un módulo, inyecta `PANEL_ACTUAL`; para enlazar a un módulo de cualquier panel, usa `urlModuloPorId('<id>')`.
   - Con esa entrada se generan solos la ruta, el `permisoGuard`, el título, el menú, la miga de pan y la entrada del buscador Ctrl/⌘K.
   - Usa los componentes de `shared/ui` (modal, confirmación, paginador, empty-state, historial) y los tokens del sistema «consola plana» (`@use 'design' as d;`, ver `frontend/DESIGN-HANDOFF.md`). No uses colores sueltos.
   - Las tablas deben seguir el patrón responsive de los módulos existentes: tarjeta por fila por debajo de 768 px y columnas prioritarias hasta 1279 px.
4. **Pruebas:** añade un test de integración en `backend/src/test/java/oracle/api/` que herede de `ApiPrueba`. Crea datos con nombres únicos y no limpies entre tests.

### Añadir un panel

1. Crea `src/app/paneles/<panel>/<panel>.panel.ts` exportando un `PanelDef`: `id`, `nombre`, `descripcion`, `icono`, `tono` (`indigo`, `violeta`, `esmeralda`, `ambar`, `cian` o `rosa`), `ruta` única, `grupos`, `modulos` y, opcionalmente, `permiso`.
2. Añádelo a `PANELES` en `src/app/paneles/registro.ts`.
3. Se generan solos: la ruta `/<ruta>` con su guard, la tarjeta del portal `/paneles`, la entrada en el conmutador de la barra lateral y en la paleta Ctrl/⌘K.

Sin `permiso`, a un panel entra quien tenga acceso a alguno de sus módulos. Para un grupo de navegación nuevo dentro de un panel, añádelo a sus `grupos`.

El permiso `PANEL_ADMIN` sigue existiendo en la BD; el panel de Administración no lo declara como `permiso`, así que hoy no se exige para entrar. Si quieres exigirlo, añádelo a `PERMISOS` y ponlo en `PANEL_ADMINISTRACION.permiso`.
