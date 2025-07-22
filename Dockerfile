FROM node:22-alpine AS node-build

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY resources/ ./resources/
COPY public/ ./public/
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY components.json ./

RUN npm run build

FROM php:8.4-fpm-alpine

RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libxml2-dev \
    zip \
    unzip \
    sqlite \
    sqlite-dev \
    && docker-php-ext-install pdo pdo_sqlite gd xml

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

RUN addgroup -g 1000 appgroup && adduser -u 1000 -G appgroup -s /bin/sh -D appuser
WORKDIR /var/www/html

COPY . .
COPY --from=node-build /app/public/build ./public/build

RUN mkdir -p bootstrap/cache storage/logs storage/framework/cache storage/framework/sessions storage/framework/views \
    && chown -R appuser:appgroup /var/www/html \
    && chmod -R 775 bootstrap/cache storage

RUN composer install --no-dev --optimize-autoloader --no-interaction

RUN chown -R appuser:appgroup /var/www/html \
    && chmod -R 755 /var/www/html \
    && chmod -R 775 /var/www/html/storage \
    && chmod -R 775 /var/www/html/bootstrap/cache

COPY docker/php-fpm.conf /usr/local/etc/php-fpm.d/www.conf

USER appuser

RUN php artisan config:cache \
    && php artisan route:cache \
    && php artisan view:cache

EXPOSE 9000

CMD ["php-fpm"]