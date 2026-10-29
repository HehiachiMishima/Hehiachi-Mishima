#!/bin/sh
# nginx en primer plano con la config generada por el entrypoint.
exec nginx -e stderr -c /run/app/nginx/nginx.conf -g 'daemon off;'
