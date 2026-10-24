# syntax=docker/dockerfile:1

# The share-link service behind link.<domain>. Build context is ./backend, but only the two
# projects it compiles are copied: it has no database, no secrets and no reason to see the rest.

# ---- Build stage ---------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props ./
COPY WebDataContracts/ WebDataContracts/
COPY StigviddLinks/ StigviddLinks/

RUN dotnet restore StigviddLinks/StigviddLinks.csproj
RUN dotnet publish StigviddLinks/StigviddLinks.csproj \
    -c Release \
    -o /app \
    --no-restore \
    /p:UseAppHost=false

# ---- Runtime stage -------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080

EXPOSE 8080

ENTRYPOINT ["dotnet", "StigviddLinks.dll"]
