# syntax=docker/dockerfile:1

# The public site. Unlike web/ (the admin) this image takes NO build args: nothing on
# the page talks to the API, Keycloak or the media server, so there is no VITE_* value
# to bake in and a rebuild is only ever needed for a content change.

# ---- Build stage ---------------------------------------------------------
# Keep in step with web/Dockerfile and with the jobs in .github/workflows/ci.yml.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage -------------------------------------------------------
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
