# syntax=docker/dockerfile:1

# ---- Build stage ---------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* vars at BUILD time, so they must be supplied as build
# args. Changing the target API/OIDC means rebuilding the web image.
ARG VITE_API_URL
ARG VITE_OIDC_URL
ARG VITE_OIDC_REALM
ARG VITE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL \
    VITE_OIDC_URL=$VITE_OIDC_URL \
    VITE_OIDC_REALM=$VITE_OIDC_REALM \
    VITE_CLIENT_ID=$VITE_CLIENT_ID

RUN npm run build

# ---- Runtime stage -------------------------------------------------------
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
