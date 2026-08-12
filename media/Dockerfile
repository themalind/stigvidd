# syntax=docker/dockerfile:1
#
# WebDAV media server: nginx with its dav module. The API PUTs uploaded images
# here (basic auth); browsers/app GET them (public). Config + auth-file
# generation are baked in; credentials come from env at runtime.
#
# PROPFIND/OPTIONS are NOT part of nginx's built-in ngx_http_dav_module and the
# official image does not ship the third-party module that provides them. This
# builder stage compiles nginx-dav-ext-module as a DYNAMIC module against the
# base image's exact nginx source (the official builds pass --with-compat, which
# is what makes that loadable), and the final stage copies just the .so in.
#
# Both stages use the same `nginx:alpine` tag, which Docker resolves once per
# build, so the module can never be compiled against a different nginx than the
# one that loads it.
FROM nginx:alpine AS davext

ARG DAV_EXT_VERSION=3.0.0

RUN set -eux; \
    apk add --no-cache --virtual .build-deps \
        build-base curl linux-headers \
        pcre2-dev zlib-dev openssl-dev libxml2-dev libxslt-dev; \
    mkdir -p /usr/src/nginx /usr/src/dav-ext; \
    curl -fsSL "https://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz" \
        | tar -xz -C /usr/src/nginx --strip-components=1; \
    curl -fsSL "https://github.com/arut/nginx-dav-ext-module/archive/refs/tags/v${DAV_EXT_VERSION}.tar.gz" \
        | tar -xz -C /usr/src/dav-ext --strip-components=1; \
    cd /usr/src/nginx; \
    ./configure --with-compat --add-dynamic-module=/usr/src/dav-ext; \
    make modules; \
    cp objs/ngx_http_dav_ext_module.so /ngx_http_dav_ext_module.so

FROM nginx:alpine

# The module links against libxml2/libxslt to build PROPFIND response bodies
# (see the `-lxml2 -lxslt -lexslt` link line in the builder stage); the base
# image carries none of them, and without these nginx fails to dlopen the .so.
RUN apk add --no-cache libxml2 libxslt

COPY --from=davext /ngx_http_dav_ext_module.so /usr/lib/nginx/modules/ngx_http_dav_ext_module.so

# load_module is only valid in nginx.conf's MAIN context, so it cannot live in
# the conf.d/ snippet below. (No `nginx -t` here: config testing opens the
# listen sockets, which fails in unprivileged builders.)
RUN sed -i '1i load_module modules/ngx_http_dav_ext_module.so;' /etc/nginx/nginx.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.d/30-media-setup.sh /docker-entrypoint.d/30-media-setup.sh
RUN chmod +x /docker-entrypoint.d/30-media-setup.sh

EXPOSE 80
