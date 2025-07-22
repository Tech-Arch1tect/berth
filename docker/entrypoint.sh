#!/bin/sh
set -e

[ -d "/var/www/html/storage" ] && chown -R appuser:appgroup /var/www/html/storage
[ -f "/var/www/html/database/database.sqlite" ] && chown appuser:appgroup /var/www/html/database/database.sqlite

exec "$@" 