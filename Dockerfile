FROM node:22-alpine AS node-build

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY resources/ ./resources/
COPY public/ ./public/
COPY vite.config.ts tsconfig.json components.json ./

RUN npm run build

FROM techarchitect/berth-php-base:latest

COPY composer.json composer.lock ./
RUN composer install --optimize-autoloader --no-interaction --no-scripts

COPY . .
COPY --from=node-build /app/public/build ./public/build

RUN mkdir -p bootstrap/cache storage/logs storage/framework/cache storage/framework/sessions storage/framework/views \
    && chown -R appuser:appgroup /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 775 /var/www/html/storage \
    && chmod -R 775 /var/www/html/bootstrap/cache

COPY docker/php-fpm.conf /usr/local/etc/php-fpm.d/www.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN composer run-script post-autoload-dump --no-interaction || true \
    && chmod +x /usr/local/bin/entrypoint.sh

USER appuser

RUN php artisan route:cache \
    && php artisan view:cache

USER root

EXPOSE 9000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["php-fpm"]