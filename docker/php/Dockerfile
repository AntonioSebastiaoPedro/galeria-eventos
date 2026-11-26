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
 && docker-php-ext-install pdo_pgsql pcntl bcmath gd zip intl exif \
 && apk add --no-cache --virtual .build $PHPIZE_DEPS && pecl install redis && docker-php-ext-enable redis && apk del .build
WORKDIR /var/www/html
COPY docker/php/uploads.ini /usr/local/etc/php/conf.d/uploads.ini
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
