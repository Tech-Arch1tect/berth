#!/bin/sh
set -e

mkdir -p /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/storage/framework/cache
[ -d "/var/www/html/storage" ] && chown -R appuser:appgroup /var/www/html/storage
[ -f "/var/www/html/database/database.sqlite" ] && chown appuser:appgroup /var/www/html/database/database.sqlite

exec "$@" 