#!/bin/sh
# Listener de supervisord: si un programa queda en FATAL (agoto sus
# reintentos), apaga supervisord para que el contenedor termine y el
# orquestador (Render / Docker restart policy) lo reinicie limpio.
# Protocolo: stdout es el canal con supervisord; los mensajes van a stderr.
set -u

printf 'READY\n'
while read -r cabecera; do
    largo=$(printf '%s\n' "$cabecera" | sed -n 's/.*len:\([0-9][0-9]*\).*/\1/p')
    carga=$(head -c "${largo:-0}")
    echo "supervisor-fatal-listener: proceso en FATAL ($carga); apagando el contenedor" >&2
    kill -TERM "$(cat /run/app/supervisord.pid)" 2>/dev/null || kill -TERM 1
    printf 'RESULT 2\nOK'
    printf 'READY\n'
done
