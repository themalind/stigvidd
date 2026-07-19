# syntax=docker/dockerfile:1
#
# Optimized Keycloak image. Baking the DB vendor in with `kc.sh build` lets the
# container run `start --optimized`, which boots fast without re-running the
# build step on every start.
FROM quay.io/keycloak/keycloak:26.1 AS build
# Build-time options must be set here (not at runtime) for `start --optimized`;
# health-enabled in particular is baked in, else the server refuses to start.
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.1
COPY --from=build /opt/keycloak/ /opt/keycloak/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized"]
