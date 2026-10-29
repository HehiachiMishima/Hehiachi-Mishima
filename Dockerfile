# syntax=docker/dockerfile:1.7
# ============================================================
# Imagen UNICA para Render: Angular (SPA) + Spring Boot (API) + nginx.
#
#   - nginx sirve el SPA en el puerto PUBLICO (PORT, lo inyecta Render)
#     y reenvia /api al backend, que escucha SOLO en 127.0.0.1:BACKEND_PORT.
#   - supervisord es el PID 1: arranca ambos procesos, reenvia SIGTERM y
#     los detiene en orden (nginx drena -> Spring graceful shutdown).
#   - Todo corre como usuario NO root (uid 10001).
#   - La base de datos es EXTERNA (Aiven/MySQL): no se incluye aqui.
#   - backend/.env NUNCA entra en la imagen (.dockerignore); la config llega
#     por variables de entorno (Render, docker run --env-file, compose).
#
# Build:   docker build -t acceso-base:local .
# Run:     docker run --rm -p 10000:10000 --env-file backend/.env acceso-base:local
#
# Imagenes base fijadas por digest (reproducible). Para actualizar:
#   docker buildx imagetools inspect <imagen:tag> --format '{{json .Manifest.Digest}}'
# ============================================================

ARG NODE_IMAGE=node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85
ARG MAVEN_IMAGE=maven:3.9-eclipse-temurin-25-alpine@sha256:781f1da87cd3d142e66e47cc149c4582a652fb7f574648206d1e956170c0dc90
ARG RUNTIME_IMAGE=eclipse-temurin:25-jre-alpine@sha256:b7528962e65d43064d8a8b67ba175367896bc948363ea2d3fcd7f10d34e1f048

# ---------- Etapa 1: frontend (Angular) ----------
FROM ${NODE_IMAGE} AS frontend
WORKDIR /app
ENV NG_CLI_ANALYTICS=false CI=true
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund --prefer-offline
COPY frontend/ ./
RUN --mount=type=cache,target=/app/.angular/cache,sharing=locked \
    npx ng build --configuration production
# Hashes CSP de los <script> inline del index.html generado.
COPY deploy/csp-hashes.mjs /tmp/csp-hashes.mjs
RUN node /tmp/csp-hashes.mjs dist/frontend/browser/index.html /app/csp-script-hashes.txt

# ---------- Etapa 2: backend (Spring Boot) ----------
FROM ${MAVEN_IMAGE} AS backend
WORKDIR /build
COPY backend/pom.xml ./
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    mvn -B -ntp -q dependency:go-offline
COPY backend/src ./src
# Jar extraido (app.jar + lib/): arranque mas rapido y capas cacheables.
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    mvn -B -ntp -q -DskipTests package \
    && cp target/*.jar app.jar \
    && java -Djarmode=tools -jar app.jar extract --destination /extraido

# ---------- Etapa 3: runtime ----------
FROM ${RUNTIME_IMAGE}

ARG VCS_REF=desconocido
LABEL org.opencontainers.image.title="acceso-base" \
      org.opencontainers.image.description="Plataforma de control de accesos: Angular + Spring Boot detras de nginx" \
      org.opencontainers.image.revision="${VCS_REF}"

# nginx + supervisord + envsubst (gettext). tini no hace falta: supervisord
# es PID 1, reenvia senales y recoge procesos huerfanos.
RUN apk add --no-cache nginx supervisor gettext \
    && addgroup -S -g 10001 app \
    && adduser -S -D -H -u 10001 -G app -h /app -s /sbin/nologin app \
    && mkdir -p /run/app /etc/nginx/plantillas \
    && chown app:app /run/app \
    && rm -f /etc/nginx/http.d/default.conf

# Dependencias primero (cambian poco) y luego el codigo de la app.
COPY --from=backend /extraido/lib /app/lib
COPY --from=backend /extraido/app.jar /app/app.jar
COPY --from=frontend /app/dist/frontend/browser /usr/share/nginx/html
COPY --from=frontend /app/csp-script-hashes.txt /app/csp-script-hashes.txt

COPY deploy/nginx/ /etc/nginx/plantillas/
COPY deploy/supervisord.conf /etc/supervisord.conf
COPY --chmod=0755 deploy/entrypoint.sh /entrypoint.sh
COPY --chmod=0755 deploy/run-backend.sh /usr/local/bin/run-backend
COPY --chmod=0755 deploy/run-nginx.sh /usr/local/bin/run-nginx
COPY --chmod=0755 deploy/supervisor-fatal-listener.sh /usr/local/bin/supervisor-fatal-listener

# PORT          publico (nginx). Render lo inyecta; por defecto 10000.
# BACKEND_PORT  interno del backend (solo 127.0.0.1). Distinto de PORT.
# JAVA_OPTS     dimensionado para 512 MB (plan free/starter de Render):
#   heap <= 50% (~256 MB) + metaspace/code cache acotados deja margen a
#   nginx + supervisord; SerialGC es el GC mas ligero con 0.1-0.5 CPU;
#   ExitOnOutOfMemoryError => supervisord/Render reinician en vez de
#   quedar un proceso zombi. En planes de >=2 GB: MaxRAMPercentage=70 y G1.
ENV PORT=10000 \
    BACKEND_PORT=2003 \
    SPRING_PROFILES_ACTIVE=prod \
    TZ=UTC \
    JAVA_OPTS="-XX:MaxRAMPercentage=50 -XX:InitialRAMPercentage=25 -XX:+UseSerialGC -XX:MaxMetaspaceSize=192m -XX:ReservedCodeCacheSize=64m -Xss512k -XX:+ExitOnOutOfMemoryError"

USER app:app
WORKDIR /app
EXPOSE 10000
STOPSIGNAL SIGTERM

# Sano = nginx responde y el backend contesta /api/health (204).
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
