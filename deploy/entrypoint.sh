#!/bin/sh
# ============================================================
# Entrypoint: valida el entorno, genera la config de nginx en
# /run/app (escribible por el usuario no root) y cede el PID 1
# a supervisord (que arranca backend + nginx).
# ============================================================
set -eu

PORT="${PORT:-10000}"
BACKEND_PORT="${BACKEND_PORT:-2003}"
NGINX_WORKER_PROCESSES="${NGINX_WORKER_PROCESSES:-1}"
# Proxies de confianza cuyo X-Forwarded-For se acepta para obtener la IP
# real del cliente. Render conecta desde su red interna (rangos privados).
REAL_IP_FROM="${REAL_IP_FROM:-10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 127.0.0.1/32 ::1/128 fc00::/7}"
REAL_IP_HEADER="${REAL_IP_HEADER:-X-Forwarded-For}"

fallar() { echo "entrypoint: ERROR: $*" >&2; exit 1; }

es_puerto() { case "$1" in ''|*[!0-9]*) return 1 ;; *) [ "$1" -ge 1 ] && [ "$1" -le 65535 ] ;; esac; }
es_puerto "$PORT" || fallar "PORT invalido: '$PORT'"
es_puerto "$BACKEND_PORT" || fallar "BACKEND_PORT invalido: '$BACKEND_PORT'"
[ "$PORT" != "$BACKEND_PORT" ] || fallar "PORT y BACKEND_PORT no pueden coincidir (=$PORT): nginx y el backend chocarian."
case "$NGINX_WORKER_PROCESSES" in auto|[1-9]|[1-9][0-9]) ;; *) fallar "NGINX_WORKER_PROCESSES invalido" ;; esac
case "$REAL_IP_HEADER" in X-Forwarded-For|X-Real-IP|CF-Connecting-IP|True-Client-IP) ;; *) fallar "REAL_IP_HEADER no soportado: '$REAL_IP_HEADER'" ;; esac

# Aviso temprano (no fatal): sin estas variables Spring no arranca.
for v in DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD JWT_SECRET; do
    eval "valor=\${$v:-}"
    [ -n "$valor" ] || echo "entrypoint: AVISO: falta la variable $v; el backend no podra arrancar." >&2
done

DESTINO=/run/app/nginx
mkdir -p "$DESTINO/tmp/client_body" "$DESTINO/tmp/proxy" "$DESTINO/tmp/fastcgi" "$DESTINO/tmp/uwsgi" "$DESTINO/tmp/scgi"

# --- real_ip: solo CIDR/IPs validos (evita inyectar directivas en nginx) ---
{
    for cidr in $(printf '%s' "$REAL_IP_FROM" | tr ',' ' '); do
        printf '%s' "$cidr" | grep -Eq '^[0-9A-Fa-f:.]+(/[0-9]{1,3})?$' || fallar "REAL_IP_FROM contiene un valor invalido: '$cidr'"
        echo "set_real_ip_from $cidr;"
    done
    echo "real_ip_header $REAL_IP_HEADER;"
    echo "real_ip_recursive on;"
} > "$DESTINO/realip.conf"

# --- Hashes CSP de los <script> inline de index.html (calculados en el build) ---
CSP_SCRIPT_HASHES="$(cat /app/csp-script-hashes.txt 2>/dev/null || true)"

export PORT BACKEND_PORT NGINX_WORKER_PROCESSES CSP_SCRIPT_HASHES
VARS='${PORT} ${BACKEND_PORT} ${NGINX_WORKER_PROCESSES} ${CSP_SCRIPT_HASHES}'
envsubst "$VARS" < /etc/nginx/plantillas/nginx.conf.template      > "$DESTINO/nginx.conf"
envsubst "$VARS" < /etc/nginx/plantillas/default.conf.template     > "$DESTINO/default.conf"
envsubst "$VARS" < /etc/nginx/plantillas/headers-spa.conf.template > "$DESTINO/headers-spa.conf"
cp /etc/nginx/plantillas/headers-common.conf /etc/nginx/plantillas/proxy-backend.conf "$DESTINO/"

nginx -e stderr -t -q -c "$DESTINO/nginx.conf" || fallar "configuracion de nginx invalida"

# --- CA de la BD (opcional): DB_CA_CERT con el PEM de Aiven -> truststore PKCS12.
# Usalo en DB_PARAMS con:
#   sslMode=VERIFY_CA&trustCertificateKeyStoreUrl=file:/run/app/db-truststore.p12
#   &trustCertificateKeyStoreType=PKCS12&trustCertificateKeyStorePassword=changeit
if [ -n "${DB_CA_CERT:-}" ]; then
    printf '%s\n' "$DB_CA_CERT" > /run/app/db-ca.pem
    rm -f /run/app/db-truststore.p12
    keytool -importcert -noprompt -alias db-ca -file /run/app/db-ca.pem \
        -keystore /run/app/db-truststore.p12 -storetype PKCS12 -storepass changeit >/dev/null \
        || fallar "DB_CA_CERT no es un certificado PEM valido"
    echo "entrypoint: truststore de la BD generado en /run/app/db-truststore.p12" >&2
fi

exec /usr/bin/supervisord -c /etc/supervisord.conf
