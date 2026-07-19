# syntax=docker/dockerfile:1
#
# WebDAV media server: nginx with its dav module. The API PUTs uploaded images
# here (basic auth); browsers/app GET them (public). Config + auth-file
# generation are baked in; credentials come from env at runtime.
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.d/30-media-setup.sh /docker-entrypoint.d/30-media-setup.sh
RUN chmod +x /docker-entrypoint.d/30-media-setup.sh

EXPOSE 80
