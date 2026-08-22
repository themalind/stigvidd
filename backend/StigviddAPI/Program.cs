using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Core;
using Core.Validators.User;
using Duende.AccessTokenManagement;
using FluentValidation;
using Infrastructure;
using Keycloak.AuthServices.Common;
using Keycloak.AuthServices.Sdk;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
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

        // A single gallery/symbol upload can carry several full-size photos, which
        // blows past Kestrel's ~30 MB default. Images are downscaled server-side after
        // upload, so we accept a generous multipart body and shrink it afterwards.
        const long maxUploadBytes = 100L * 1024 * 1024; // 100 MB
        builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = maxUploadBytes);
        builder.Services.Configure<FormOptions>(options => options.MultipartBodyLengthLimit = maxUploadBytes);

        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend",
                policy =>
                {
                    if (builder.Environment.IsDevelopment())
                    {
                        // Dev is reached from localhost and from LAN IPs (device / cross-machine
                        // testing), so reflect any origin. Safe here: auth is Bearer-token based,
                        // not cookie based, so we are not exposing credentialed requests.
                        policy
                            .SetIsOriginAllowed(_ => true)
                            .AllowAnyHeader()
                            .AllowAnyMethod();
                    }
                    else
                    {
                        policy
                            .WithOrigins("https://stigvidd.se", "https://api.stigvidd.se")
                            .AllowAnyHeader()
                            .AllowAnyMethod();
                    }
                });
        });

        builder.Services.AddKeycloakWebApiAuthentication(builder.Configuration);

        // Flatten Keycloak realm roles into Role claims, then gate endpoints on
        // configurable realm roles.
        builder.Services.AddSingleton<IClaimsTransformation, StigviddAPI.Authorization.KeycloakRealmRolesTransformation>();
        var adminRole = builder.Configuration["Authorization:AdminRole"] ?? "stigvidd-admin";

        // The member realm role is not provisioned in Keycloak yet. While
        // Authorization:UserRole is unset the "User" policy means "any authenticated
        // caller"; setting it switches on role enforcement without a code change.
        var userRole = builder.Configuration["Authorization:UserRole"];

        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy("Admin", policy => policy.RequireRole(adminRole));

            options.AddPolicy("User", policy =>
            {
                policy.RequireAuthenticatedUser();

                if (!string.IsNullOrWhiteSpace(userRole))
                {
                    // Admins are members too, so either role satisfies the policy.
                    policy.RequireRole(userRole, adminRole);
                }
            });

            // Endpoints without any authorization metadata require a signed-in caller,
            // so a forgotten attribute fails closed. Public endpoints opt out with
            // [AllowAnonymous].
            options.FallbackPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();
        });

        var options = builder.Configuration.GetKeycloakOptions<KeycloakAdminClientOptions>(configSectionName: "KeycloakAdminClient")
            ?? throw new InvalidOperationException("KeycloakAdminClientOptions not found in configuration.");

        builder.Services.AddDistributedMemoryCache();
        builder.Services
            .AddClientCredentialsTokenManagement()
            .AddClient(
                "KeycloakAdminTokenClient",
                client =>
                {
                    client.ClientId = ClientId.Parse(options.Resource);
                    client.ClientSecret = ClientSecret.Parse(options.Credentials.Secret);
                    client.TokenEndpoint = new Uri(options.KeycloakTokenEndpoint);
                }
            );

        builder.Services
            .AddKeycloakAdminHttpClient(options)
            .AddClientCredentialsTokenHandler(ClientCredentialsClientName.Parse("KeycloakAdminTokenClient"));

        builder.Services.AddControllers()
        .AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        });

        builder.Services.AddFluentValidationAutoValidation(config =>
        {
            config.EnableFormBindingSourceAutomaticValidation = true;
        });

        // Automatically register all validators from the assembly
        builder.Services.AddValidatorsFromAssemblyContaining<AddToUserFavoriteValidator>();

        builder.Services.AddOpenApi();

        var connectionString = builder.Configuration.GetConnectionString("StigVidd")
            ?? throw new InvalidOperationException("Connection string 'StigVidd' not found.");

        builder.Services.AddStigVidd(connectionString);

        // Logs, traces and metrics over OTLP. Registers nothing at all unless
        // Otlp:Endpoint is configured — see Extensions/TelemetryExtensions.cs.
        builder.AddStigViddTelemetry();

        builder.Services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

        // Deletes obstacle reports once they are past their retention period
        builder.Services.AddHostedService<StigviddAPI.BackgroundServices.ExpiredObstacleCleanupService>();
        builder.Services.AddHostedService<StigviddAPI.BackgroundServices.TrailImportAnalysisWorker>();

        // Swagger auth
        builder.Services.AddOpenApiDocument(config =>
        {
            config.Title = "StigVidd";

            config.AddSecurity("Bearer", new NSwag.OpenApiSecurityScheme
            {
                Type = NSwag.OpenApiSecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = NSwag.OpenApiSecurityApiKeyLocation.Header,
                Name = "Authorization",
                Description = "Skriv: Bearer {din Keycloak access token}"
            });

            config.OperationProcessors.Add(
                 new NSwag.Generation.Processors.Security.OperationSecurityScopeProcessor("Bearer")
            );
        });

        var app = builder.Build();

        // Run database migrations at startup
        foreach (var migrationRunner in app.Services.GetServices<IDbMigrationRunner>())
        {
            await migrationRunner.RunMigrationsAsync(app.Lifetime.ApplicationStopping);
        }

        app.UseExceptionHandler(appError =>
        {
            appError.Run(async context =>
            {
                var exception = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
                var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();

                // Activity.Current is still the ASP.NET Core request activity here, so this is
                // the same trace id the span carries: paste it into OpenObserve and you land on
                // the failing request. Falls back to TraceIdentifier when telemetry is off.
                //
                // OTLP log records carry TraceId as a field automatically; naming it in the
                // template is what makes the plain CONSOLE output correlatable too, which is
                // the only view available when telemetry is not configured.
                //
                // The response body is deliberately left empty, as before. Errors the service
                // layer handles already come back as ProblemDetails carrying a traceId (MVC
                // does that for [ApiController] error results), and inventing a different
                // shape here would make the two 500 paths disagree.
                var traceId = Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;

                logger.LogError(exception, "Unhandled exception. TraceId: {TraceId}", traceId);

                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                await context.Response.CompleteAsync();
            });
        });

        app.UseCors("AllowFrontend");

        // Configure the HTTP request pipeline.
        if (app.Environment.IsDevelopment())
        {
            app.UseOpenApi();
            app.UseSwaggerUi();
            app.MapOpenApi().AllowAnonymous();
        }

        // Liveness and readiness. Unauthenticated by design, and both paths are excluded from
        // tracing (see TelemetryExtensions.IsWorthTracing) so they cannot flood the pipe.
        app.MapHealthChecks("/healthz", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
        app.MapHealthChecks("/readyz", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") }).AllowAnonymous();

        // The probes must skip the HTTPS redirect: the container serves plain HTTP on 8080
        // behind Caddy and the Docker healthcheck hits 127.0.0.1:8080 directly, so a redirect
        // would turn every probe into a 307.
        //
        // Where the Map calls above sit relative to this does NOT achieve that. With no
        // explicit UseRouting(), WebApplication inserts routing at the head of the pipeline and
        // endpoint execution at the tail, so UseHttpsRedirection always runs first regardless.
        // It is inert today only because no HTTPS port is configured (the image sets
        // ASPNETCORE_HTTP_PORTS=8080 and nothing else), which makes the middleware log
        // "Failed to determine the https port for redirect" and pass through. This UseWhen is
        // what keeps the probes answering 200 if an HTTPS port is ever added.
        app.UseWhen(context => !IsProbePath(context.Request.Path), branch => branch.UseHttpsRedirection());

        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllers();

        app.Run();
    }

    private static bool IsProbePath(PathString path) =>
        path.StartsWithSegments("/healthz") || path.StartsWithSegments("/readyz");
}