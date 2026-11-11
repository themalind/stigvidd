// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Globalization;
using System.Text.Json;
using Core;
using Core.Validators.Account;
using FluentValidation;
using Infrastructure;
using SharpGrip.FluentValidation.AutoValidation.Mvc.Extensions;
using StigviddAPI.Extensions;

namespace StigviddAPI;

public class Program
{
    private static async Task Main(string[] args)
    {
        CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
        CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

        var builder = WebApplication.CreateBuilder(args);

        builder.Host.UseDefaultServiceProvider(options =>
        {
            options.ValidateOnBuild = true;
            options.ValidateScopes = true;
        });

        var connectionString = builder.Configuration.GetConnectionString("StigVidd")
            ?? throw new InvalidOperationException("Connection string 'StigVidd' not found.");

        builder.AddStigviddUploadLimits();
        builder.AddStigViddTelemetry();

        builder.Services.AddStigVidd(connectionString);
        builder.Services
            .AddStigviddCors(builder.Configuration, builder.Environment)
            .AddStigviddAuth(builder.Configuration)
            .AddStigviddKeycloakAdminClient(builder.Configuration)
            .AddStigviddRateLimiting()
            .AddStigviddHealthChecks()
            .AddStigviddBackgroundServices()
            .AddStigviddOpenApi();

        builder.Services
            .AddControllers(options => options.Filters.Add<BannedUserWriteFilter>())
            .AddJsonOptions(options => options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

        // Registers every validator in Core, which is why they must live under Core/Validators/.
        builder.Services.AddFluentValidationAutoValidation(config => config.EnableFormBindingSourceAutomaticValidation = true);
        builder.Services.AddValidatorsFromAssemblyContaining<AddToUserFavoriteValidator>();

        var app = builder.Build();

        // Must run before the migrations: the build exports web/openapi.json this way without a database.
        var openApiExportPath = OpenApiExtensions.ReadOpenApiExportPath(args);
        if (openApiExportPath is not null)
        {
            await app.ExportOpenApiDocumentAsync(openApiExportPath);
            return;
        }

        LogStartup(app);

        foreach (var migrationRunner in app.Services.GetServices<IDbMigrationRunner>())
        {
            await migrationRunner.RunMigrationsAsync(app.Lifetime.ApplicationStopping);
        }

        app.UseStigviddExceptionHandler();
        app.UseCors(CorsExtensions.PolicyName);

        if (app.Environment.IsDevelopment())
        {
            app.UseOpenApi();
            app.UseSwaggerUi();
            app.MapOpenApi().AllowAnonymous();
        }

        app.MapStigviddHealthChecks();

        // Probes skip the HTTPS redirect: Docker hits plain HTTP on 8080, and a redirect would make them 307.
        app.UseWhen(context => !RequestLoggingMiddleware.IsProbePath(context.Request.Path), branch => branch.UseHttpsRedirection());

        app.UseAuthentication();
        app.UseMiddleware<RequestLoggingMiddleware>();
        app.UseAuthorization();
        app.UseRateLimiter();

        app.MapControllers();

        app.Run();
    }

    private static void LogStartup(WebApplication app)
    {
        var configuration = app.Configuration;
        var otlpEndpoint = configuration["Otlp:Endpoint"] ?? configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];

        app.Logger.LogInformation(
            "Stigvidd API starting: environment {Environment}, version {ServiceVersion}, Keycloak {KeycloakServerUrl} realm {KeycloakRealm}, OTLP export {OtlpExport}.",
            app.Environment.EnvironmentName,
            configuration["Otlp:ServiceVersion"] ?? "unknown",
            configuration["Keycloak:auth-server-url"] ?? "unset",
            configuration["Keycloak:realm"] ?? "unset",
            string.IsNullOrWhiteSpace(otlpEndpoint) ? "off" : "on");
    }
}
