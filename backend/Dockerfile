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
COPY --from=build /app .

# Kestrel listens on 8080 (no HTTPS inside the container; terminate TLS at the
# reverse proxy / load balancer in front of the stack).
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080

EXPOSE 8080

ENTRYPOINT ["dotnet", "StigviddAPI.dll"]
