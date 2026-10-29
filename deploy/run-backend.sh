#!/bin/sh
# Lanza Spring Boot (jar extraido: arranque mas rapido que el fat-jar).
# JAVA_OPTS permite ajustar la JVM sin reconstruir la imagen (render.yaml).
# shellcheck disable=SC2086
exec java $JAVA_OPTS -jar /app/app.jar --server.port="$BACKEND_PORT" --server.address=127.0.0.1
