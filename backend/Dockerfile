# syntax=docker/dockerfile:1

# ---- Build stage ---------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy the whole backend solution (restore pulls in Core, WebDataContracts,
# Infrastructure and MapData transitively via the project graph).
COPY . .

RUN dotnet restore StigviddAPI/StigviddAPI.csproj
RUN dotnet publish StigviddAPI/StigviddAPI.csproj \
    -c Release \
    -o /app \
    --no-restore \
    /p:UseAppHost=false

# ---- Runtime stage -------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# pg_dump/pg_restore for the admin export/import feature. Pinned to the same
# major as the server (Postgres 16) via the PGDG repo; codename is derived so
# this survives a base-image OS bump.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
         -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
         > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-16 \
    && apt-get purge -y gnupg \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app .

# Kestrel listens on 8080 (no HTTPS inside the container; terminate TLS at the
# reverse proxy / load balancer in front of the stack).
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080

EXPOSE 8080

ENTRYPOINT ["dotnet", "StigviddAPI.dll"]
