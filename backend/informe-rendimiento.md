# Informe de auditoría de rendimiento — hehiachi-mishima (migración a PostgreSQL + Spring MVC/JPA)

## 1. Contexto

| Campo | Valor |
|---|---|
| Fecha | 2026-11-06 |
| Commit | 57e8607 + cambios sin commitear de la migración |
| Entorno | local, macOS, 6 CPU; PostgreSQL 17 en Testcontainers (fsync=off); 200 peticiones simultáneas por escenario (`CargaTest`) |
| Backend | Spring Boot 4.1.2, Hibernate 7, HikariCP (pool fijo 20), driver PostgreSQL (BOM de Boot), JDK 25, virtual threads sí |
| Base de datos | PostgreSQL 17, max_connections 300 (pruebas), sin PgBouncer; medido con el esquema `app` de entonces (bitácora particionada). Hoy el esquema es `backend/schema.sql` (comun/seguridad/bitacora, sin particiones): repetir las mediciones de bitácora antes de comparar |
| Frontend | Angular 22, builder application (esbuild), RxJS 7.8 |
| Umbrales | LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1 · p95 API ≤ 200 ms · bundle inicial ≤ 500 KB · `hikaricp.connections.pending` = 0 · `hikaricp.connections.timeout` = 0 |
| Fuera de alcance | Seguridad, SEO, accesibilidad, costes cloud |

## 2. Línea base

| Métrica | Escenario | Valor | Umbral | Fuente | Fecha |
|---|---|---|---|---|---|
| Logins con error 500 | 200 logins simultáneos, BCrypt 10 | 57 de 200 | 0 | `./mvnw test -Dtest=CargaTest -Dcarga=true -Dpruebas.bcrypt-coste=10` | 2026-11-06 |
| Esperas en Hikari | ídem | active=20, waiting=37, timeout 3 461 ms | pending 0 | log `HikariPool-1 - Connection is not available` | 2026-11-06 |
| p95 GET /api/usuarios/{id} | 200 simultáneas | 482 ms | 200 ms | `target/carga-informe.txt` | 2026-11-06 |
| p95 GET /api/auditoria (página 25) | 200 simultáneas | 631 ms | 200 ms | ídem | 2026-11-06 |
| p95 GET /api/roles | 200 simultáneas | 339 ms | 200 ms | ídem | 2026-11-06 |
| Búsqueda de usuarios con filtro | `GET /api/usuarios/buscar?nombre=x` | 500 (error SQL) | 200 ms | log `operator does not exist: text ~~* bytea`; 9 pruebas fallidas | 2026-11-06 |
| Búsqueda "contiene" en 200 000 usuarios | `EXPLAIN (ANALYZE, BUFFERS)` | 16 ms, Bitmap Index Scan en `idx_usuarios_busqueda_trgm` | 20 ms | psql sobre datos sintéticos | 2026-11-06 |
| Página 1 de bitácora, 1 M de eventos | `EXPLAIN (ANALYZE, BUFFERS)` | 0,17 ms, Merge Append de Index Only Scan por partición | 20 ms | psql sobre datos sintéticos | 2026-11-06 |
| Bundle inicial | `npx ng build` | 359,79 KB | 500 KB | salida de `ng build` (Initial total) | 2026-11-06 |
| LCP / INP / CLS | rutas /login, resumen, usuarios | Pendiente | 2,5 s / 200 ms / 0,1 | `npx lighthouse http://localhost:4200/<ruta> --preset=desktop --output=json` ×3 con backend real | 2026-11-06 |

## 3. Hallazgos

| Severidad | Dominio | Evidencia | Anti-patrón | Corrección propuesta | Métrica esperada |
|---|---|---|---|---|---|
| Crítica | Backend | 57/200 logins con 500; log `active=20, idle=0, waiting=37` con `spring.threads.virtual.enabled=true` (application.properties:63) | Trabajo CPU puro (BCrypt) en hilos virtuales: no se desalojan, los carriers se agotan y las peticiones con conexión no pueden reanudarse para devolverla | BCrypt en pool de hilos de plataforma = nº de CPU (`CodificacionContrasenas.java:32` y `:38`, delegado `BcryptAcotado`) | 0 errores en 200 logins simultáneos; 0 timeouts de Hikari |
| Alta | Base de datos | `UsuarioRepository.java:35` (versión MySQL) `(:usuario IS NULL OR u.usuario LIKE ...)`; en PostgreSQL `operator does not exist: text ~~* bytea` | Filtro "catch-all" con parámetros opcionales: no tipa nulos e impide elegir índice | `Especificaciones` dinámicas: solo filtros informados con ILIKE escapado (`UsuarioRepository.java:46`, igual en Rol/Permiso) + índices GIN de trigramas (V1) | 0 errores 500 en `/buscar`; búsqueda en 200 000 filas ≤ 20 ms con Bitmap Index Scan |
| Media | Base de datos | `ResolucionRepository.java` (versión MySQL) `WHERE ur.usuario_id IN (%s)` con n marcadores | Sentencia distinta por cada tamaño de lote: el caché de sentencias preparadas no se reutiliza | Un único parámetro `bigint[]`: `= ANY (?)` (`ResolucionRepository.java:113` y `:130`) | 1 forma de sentencia por consulta en `pg_stat_statements` en lugar de hasta 100 |

## 4. Clasificación

| Verificación | Dominio | Estado | Motivo / siguiente paso |
|---|---|---|---|
| CPU en hilos virtuales retiene conexiones | Backend | Aplicable | Ver hallazgo 1 |
| Filtros opcionales catch-all | Base de datos | Aplicable | Ver hallazgo 2 |
| IN con número variable de marcadores | Base de datos | Aplicable | Ver hallazgo 3 |
| Open Session in View | Backend | No aplicable | `spring.jpa.open-in-view=false` (application.properties:52) |
| Fugas de conexión / idle in transaction | Backend | No aplicable | `leak-detection-threshold=20000` e `idle_in_transaction_session_timeout=60000` (application.properties:28, :37); 0 avisos de fuga en la suite de 264 pruebas |
| Consultas desbocadas | Base de datos | No aplicable | `statement_timeout` por conexión (application.properties:28) y 57014 → 503 en `GlobalExceptionHandler` |
| N+1 en overrides | Backend | No aplicable | `UsuarioPermisoRepository` usa `JOIN FETCH` |
| Orden y paginación de la bitácora | Base de datos | No aplicable | Partición mensual + índice `(ocurrido_en DESC, id DESC)`: 0,17 ms sin Sort sobre 1 M de filas |
| CREATE INDEX sin CONCURRENTLY (23 coincidencias del escáner) | Base de datos | No aplicable | Todas sobre tablas creadas vacías en la misma migración: no bloquean datos existentes |
| IDENTITY sin batching (3 coincidencias) | Backend | No aplicable | Altas unitarias desde la API; la bitácora usa `batchUpdate` + `reWriteBatchedInserts` |
| Latencia de login bajo ráfaga | Backend | No aplicable | p95 4,9 s con 200 BCrypt simultáneos en 6 CPU: límite de CPU por diseño (coste 10), no de base de datos |
| Bundle inicial | Frontend | No aplicable | 359,79 KB < 500 KB |
| Core Web Vitals | Frontend | Pendiente | Lighthouse ×3 por ruta con backend real (comando en Línea base) |
| Bloat y autovacuum | Base de datos | Pendiente | Ejecutar `pg_health.sql` sobre la base de Render tras 7 días de uso |

## 5. Plan priorizado

| Orden | Nivel | Hallazgo | Impacto/Esfuerzo |
|---|---|---|---|
| 1 | N1 | BCrypt fuera de los hilos virtuales | 5 / 1 → Hecho |
| 2 | N3 | Filtros dinámicos + trigramas | 4 / 2 → Hecho |
| 3 | N3 | `= ANY(bigint[])` en lotes | 2 / 1 → Hecho |

## 6. Verificación antes/después

| Métrica | Antes | Después | Δ | Estado |
|---|---|---|---|---|
| Logins con error en 200 simultáneos | 57 | 0 | −100 % | Mejora |
| Timeouts de conexión Hikari en la ráfaga | 57 | 0 | −100 % | Mejora |
| p95 GET /api/usuarios/{id} | 482 ms | 239 ms | −50 % | Mejora |
| p95 GET /api/auditoria (página 25) | 631 ms | 352 ms | −44 % | Mejora |
| p95 GET /api/roles | 339 ms | 236 ms | −30 % | Mejora |
| Pruebas de búsqueda (/buscar) | 9 fallidas | 0 fallidas | −100 % | Mejora |
| p95 login (ráfaga de 200) | 4 007 ms (con 57 errores) | 4 882 ms (sin errores) | +22 % | Sin cambio |

## 7. Veredicto

La migración a PostgreSQL deja la base lejos de ser el cuello de botella: la búsqueda por trigramas resuelve 200 000 usuarios en 16 ms y la bitácora particionada pagina un millón de eventos en 0,17 ms. Lo crítico estaba en el backend: BCrypt en hilos virtuales monopolizaba los carriers y agotaba Hikari (57 de 200 logins fallaban). Moverlo a un pool de plataforma eliminó todos los errores y bajó entre un 30 % y un 50 % el p95 de las lecturas concurrentes. El p95 del login en ráfaga sigue alto porque es CPU pura por diseño: más hilos de Tomcat o un pool mayor no lo arreglan; solo más CPU o un coste BCrypt menor. Las lecturas siguen por encima de 200 ms en una ráfaga de 200 simultáneas en una sola máquina, que no es carga sostenida: falta medir p95 a RPS constante y los Core Web Vitals contra el entorno de Render.
