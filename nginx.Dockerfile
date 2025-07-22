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

FROM nginx:alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=node-build /app/public /var/www/html/public

RUN addgroup -g 1000 appgroup && adduser -u 1000 -G appgroup -s /bin/sh -D appuser \
    && chown -R appuser:appgroup /var/www/html/public \
    && chmod -R 755 /var/www/html/public

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]