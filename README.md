# Plataforma de Control de Accesos

Sistema de gestion de identidades, roles y permisos.

- **Frontend**: Angular 22 (standalone, zoneless) + SCSS.
- **Backend**: Spring Boot 4.1.1 (Java 21), API REST stateless con JWT (HS256).
- **Base de datos**: MySQL.

---

## Estructura del proyecto

```
.
├── Dockerfile               # Imagen unica: frontend + backend + nginx
├── render.yaml              # Blueprint de despliegue en Render (1 servicio)
├── backend/                 # API Spring Boot
│   ├── .env.example         # Plantilla de variables de entorno
│   ├── certs/ca.pem         # CA TLS
│   ├── schema.sql           # Esquema de la base de datos
│   └── src/
└── frontend/                # SPA Angular
    └── src/
```

---

## Arquitectura de la imagen (todo en uno)

Un **unico contenedor / un unico servicio**:

```
        navegador
            │  (HTTP : PORT = puerto publico)
            ▼
      ┌───────────────────────────────┐
      │  nginx  (puerto PORT)          │  sirve el SPA Angular
      │    /            -> SPA         │
      │    /api/*       -> backend     │
      └───────────────┬───────────────┘
                      ▼  (localhost:BACKEND_PORT, interno)
                Spring Boot (JWT)  ──►  MySQL
```

- `PORT` (por defecto `10000`) es el **unico puerto publicado**; `BACKEND_PORT`
  (por defecto `2003`) es **interno** y no sale del contenedor.
- nginx sirve el SPA y hace de proxy inverso de `/api` hacia el backend.
- `supervisord` arranca **nginx + backend** en el mismo contenedor.
- El SPA usa `apiUrl: '/api'` (mismo origen): **no hay CORS** entre el
  navegador y la API.

---

## Requisitos

- Java 21 y Node 22 (desarrollo sin Docker).
- Docker (imagen/contenedor).
- MySQL accesible.

---

## Configuracion del entorno

El backend lee sus credenciales de `backend/.env` (que **no se sube al
repositorio**). Hay un archivo por entorno: para cambiar de modo, copia el
que quieras sobre `.env`.

| Archivo | Para que | Base de datos |
| --- | --- | --- |
| `backend/.env.local` | Desarrollo sin Docker (`mvnw` + Angular) | MySQL local |
| `backend/.env.aiven` | Probar el contenedor con produccion | Aiven |

```bash
cp backend/.env.local backend/.env     # trabajar en local
cp backend/.env.aiven backend/.env     # probar el contenedor con Aiven
```

O parte de la plantilla en blanco:

```bash
cp backend/.env.example backend/.env
```

Render **no usa estos archivos**: inyecta las variables desde el dashboard
(ver `render.yaml`).

| Variable | Descripcion |
| --- | --- |
| `PORT` | Puerto **publico** del contenedor (nginx). Es el unico que se publica con `-p`. Render lo inyecta (`10000`). |
| `BACKEND_PORT` | Puerto **interno** del backend Java (no se publica). Debe ser **distinto** de `PORT`. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PARAMS` | Conexion MySQL. |
| `JWT_SECRET` | Firma JWT, minimo 32 caracteres (`openssl rand -hex 32`). |
| `CORS_ALLOWED_ORIGINS` | Origenes del frontend, separados por comas. |
| `USER_*` | Usuario administrador semilla (se crea al arrancar si no existe). |

---

## Desarrollo local

> Requiere `backend/.env` = perfil local: `cp backend/.env.local backend/.env`.
> El backend escucha en `BACKEND_PORT` (`2003`), que es lo que usa el frontend.

### Backend

```bash
cd backend
./mvnw spring-boot:run
```

API en `http://localhost:2003/api`.

### Frontend

```bash
cd frontend
npm install
npm start
```

SPA en `http://localhost:4200` (usa `environment.development.ts`).

---

## Docker (imagen unica)

La imagen expone **un solo puerto al exterior**: `PORT` (por defecto `10000`),
que sirve nginx. El backend Java queda en un puerto **interno**
(`BACKEND_PORT`, `2003`) al que solo llega nginx.

> Regla de oro: al publicar, mapea al **puerto publico**, no al interno.
> `-p <host>:10000` ✅ &nbsp;|  `-p 2003:2003` ❌ (nadie escucha en 2003 dentro).

Construir y ejecutar **un solo contenedor** (sin compose):

```bash
docker build -t hehiachi-mishima .
docker run --rm --env-file backend/.env -p 8080:10000 hehiachi-mishima
```

- App completa: `http://localhost:8080`
- El host (`8080`) es libre; el lado derecho **debe** ser `PORT` (`10000` por defecto).

Si cambias `PORT` (p. ej. `-e PORT=3000`), publica ese mismo:
`docker run ... -p 8080:3000`. Nunca pongas `PORT` igual a `BACKEND_PORT`:
el entrypoint lo detecta y aborta con un error claro.

Si tu MySQL corre en el host, define `DB_HOST=host.docker.internal` en
`backend/.env` (Docker Desktop en macOS ya resuelve ese nombre).

---

## Despliegue en Render

`render.yaml` crea **un solo servicio web** (`farmacias-peruanas`) a partir
del `Dockerfile` de la raiz.

Pasos:

1. Sube el repositorio a GitHub/GitLab.
2. En Render: **New + > Blueprint** y selecciona el repositorio.
3. Render pedira los valores marcados con `sync: false`
   (credenciales de la base de datos y datos del administrador).
4. Al terminar, abre la URL de `farmacias-peruanas`.

Notas:

- La imagen escucha en `PORT` (Render usa `10000`); el backend queda en el
  puerto interno `2003`.
- El health check es `GET /api/health` (publico, responde `204`).
- En `plan: free` el servicio se suspende tras 15 min de inactividad y
  tarda ~1 min en reactivarse.

---

## Endpoints principales

Base: `/api`

| Metodo | Ruta | Acceso |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Publico |
| `GET` | `/api/health` | Publico |
| Resto | `/api/**` | Requiere JWT (`Authorization: Bearer ...`) |

---

## Seguridad

- `backend/.env` esta ignorado por Git; **no** lo subas.
- Rota `JWT_SECRET` y las credenciales de la base de datos de forma
  periodica.
- En Render, los secretos se piden al crear el Blueprint y nunca se
  escriben en `render.yaml`.
