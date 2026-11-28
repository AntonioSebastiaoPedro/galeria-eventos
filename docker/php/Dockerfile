FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM composer:2 AS vendor
WORKDIR /build
COPY backend/composer.* ./
RUN composer install --no-dev --no-scripts --prefer-dist --ignore-platform-reqs

FROM php:8.4-fpm-alpine AS app
# GD com JPEG/WebP (fotografias de telemóvel), exif (rotação das fotografias), zip (descarregar o evento em ZIP)
# e FFmpeg (capa e duração dos vídeos).
RUN apk add --no-cache postgresql-dev libpng-dev libjpeg-turbo-dev libwebp-dev freetype-dev libzip-dev icu-dev ffmpeg \
 && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
 && docker-php-ext-install pdo_pgsql pcntl bcmath gd zip intl exif opcache \
 && apk add --no-cache --virtual .build $PHPIZE_DEPS && pecl install redis && docker-php-ext-enable redis && apk del .build
WORKDIR /var/www/html
COPY docker/php/uploads.ini /usr/local/etc/php/conf.d/uploads.ini
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini
COPY docker/php/fpm-pool.conf /usr/local/etc/php-fpm.d/zz-pool.conf
COPY backend/ ./
COPY --from=vendor /build/vendor ./vendor
RUN chown -R www-data:www-data storage bootstrap/cache
# O Makefile (make setup / make composer) corre o Composer dentro deste contentor.
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
# Os serviços (php-fpm, queue, scheduler, reverb) correm sem privilégios de root. O deploy.sh acerta o dono
# dos ficheiros que já existem no volume de armazenamento.
USER www-data

# Servidor web de produção: interface (PWA) + proxy para a API e o WebSocket.
FROM nginx:stable-alpine AS web
COPY docker/nginx/prod.conf /etc/nginx/conf.d/default.conf
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=frontend /build/dist /var/www/spa
# O nginx lê os ficheiros do volume de armazenamento (X-Accel-Redirect), que são do www-data (uid 82) do PHP
# e ficam em pastas só para o dono: os processos do nginx passam a correr com esse mesmo utilizador.
RUN (getent group www-data || addgroup -g 82 -S www-data) \
 && (getent passwd www-data || adduser -u 82 -S -D -H -G www-data www-data) \
 && sed -i 's/^user .*/user www-data;/' /etc/nginx/nginx.conf \
 && chown -R www-data:www-data /var/cache/nginx
