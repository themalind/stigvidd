# syntax=docker/dockerfile:1
#
# Toolchain image for the Jenkins backend test stage.
#
# The pipeline builds this via `agent { dockerfile }` rather than pulling a
# named tag, so it lives in the agent's local layer cache: the SpatiaLite
# apt-get runs once (on the first build after this file changes) instead of on
# every single build. Context is the `ci/` directory only, so the build context
# upload is a few kilobytes.
FROM mcr.microsoft.com/dotnet/sdk:10.0

# SpatiaLite — the integration tests run against SQLite in-memory with the
# spatial extension loaded (mirrors .github/workflows/ci.yml).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
         libsqlite3-mod-spatialite libspatialite-dev \
    && rm -rf /var/lib/apt/lists/*

ENV DOTNET_NOLOGO=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1
