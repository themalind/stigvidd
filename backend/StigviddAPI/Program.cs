// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
using NSwag.Generation;
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
                        // The browser origins that call this API. THIS LIST IS THE ONLY
                        // THING THAT ALLOWS THEM, and nothing tests it: the integration
                        // suite boots as Development and takes the branch above, which
                        // reflects any origin. So a missing entry here is green on every
                        // test run and a blocked request in production only.
                        //
                        // https://stigvidd.se is the public site (site/), which makes no
                        // API calls today but is the apex a browser may arrive from.
                        // https://admin.stigvidd.se is the admin UI (web/) — it moved off
                        // the apex when the public site took it over.
                        policy
                            .WithOrigins(
                                "https://stigvidd.se",
                                "https://admin.stigvidd.se",
                                "https://api.stigvidd.se")
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

        builder.Services.AddAuthorization(options =>
        {
            // The realm has one role. Everything else an endpoint can ask for is
            // "signed in", which is a bare [Authorize] and needs no policy.
            //
            // This name is an UNCHECKED STRING: nothing resolves [Authorize(Policy = "...")]
            // against it until a request arrives, and a miss is a 500 rather than a startup
            // error. Renaming it means editing every attribute AND the literal in
            // EndpointAuthorizationTests - see
            // docs/notes/authorize-policy-names-are-unchecked-strings.md.
            options.AddPolicy("AdminOnly", policy => policy.RequireRole(adminRole));

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

        builder.Services.AddControllers(options => options.Filters.Add<BannedUserWriteFilter>())
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

        // Drains the mail outbox. Triggered by the in-memory queue, reconciled against the
        // OutboxEmails table on every start.
        builder.Services.AddHostedService<StigviddAPI.BackgroundServices.MailOutboxDispatcher>();

        // Holds OutboxEmails to its retention rule: clears settled bodies, then deletes sent
        // and settled rows past their windows. Configured under MailOutbox in appsettings.json.
        builder.Services.AddHostedService<StigviddAPI.BackgroundServices.MailOutboxRetentionService>();

        builder.Services.AddHostedService<StigviddAPI.BackgroundServices.MediaReprocessDispatcher>();
        builder.Services.AddHostedService<StigviddAPI.BackgroundServices.MediaReprocessRetentionService>();

        // Swagger auth
        builder.Services.AddOpenApiDocument(config =>
        {
            config.Title = "StigVidd";

            // AGPL section 13: everyone who interacts with this server over a network
            // is entitled to its Corresponding Source. Putting the offer in the OpenAPI
            // description means it reaches API consumers, who never see the app's or the
            // admin web's About screen. Editing this text changes the API contract: orval
            // copies info.description into the header of EVERY file it emits, so the next
            // `dotnet build` rewrites web/openapi.json and the whole generated client then
            // differs. Run `cd web && npm run generate:api` and commit src/api/generated.
            config.Description =
                "Stigvidd API. This is free software, licensed under the GNU Affero General "
                + "Public License version 3 or later. Under section 13 of that licence you "
                + "are entitled to the Corresponding Source of this running service: "
                + "https://github.com/themalind/stigvidd";

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

        // --export-openapi <path> writes the OpenAPI document and exits, serving nothing.
        //
        // This is what produces web/openapi.json, which is gitignored and is orval's input
        // for the committed client under web/src/api/generated. It is driven by
        // scripts/generate-openapi.mjs, which the StigviddAPI build runs after every Debug
        // build, so the document is refreshed by an ordinary `dotnet build`.
        //
        // It has to sit HERE, between Build() and the migration loop below, and that
        // position is the whole reason this is a switch rather than an external tool:
        // NSwag's own CLI (aspnetcore2openapi) reaches the service provider through
        // HostFactoryResolver, which runs Main straight past this point into
        // RunMigrationsAsync and then dies on a database it has no reason to need.
        // Measured, and it is why that approach was abandoned.
        //
        // The generator resolved here is the same one the /swagger/v1/swagger.json endpoint
        // uses, so the two documents agree by construction rather than by luck.
        var openApiExportPath = ReadOpenApiExportPath(args);
        if (openApiExportPath is not null)
        {
            var generator = app.Services.GetRequiredService<IOpenApiDocumentGenerator>();
            var document = await generator.GenerateAsync("v1");

            var directory = Path.GetDirectoryName(openApiExportPath);
            if (!string.IsNullOrEmpty(directory))
                Directory.CreateDirectory(directory);

            // Newtonsoft indents with Environment.NewLine, so ToJson() is CRLF on Windows and
            // LF everywhere else. Normalising means a Windows box and a Linux box produce the
            // same bytes from the same API - which matters because the CLIENT generated from
            // this file IS committed and Jenkins diffs it.
            // See docs/notes/openapi-snapshot-fails-on-windows-line-endings.md.
            var json = document.ToJson().Replace("\r\n", "\n");
            await File.WriteAllTextAsync(openApiExportPath, json);

            Console.WriteLine($"Wrote {json.Length} characters of OpenAPI document to {openApiExportPath}");
            return;
        }

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

    // Reads the path out of `--export-openapi <path>`, or null when the switch is absent —
    // which is every invocation except the build's document export, so the serving path is
    // untouched. An absolute path is returned because the caller's working directory is
    // StigviddAPI/ while the file belongs at the repository root.
    private static string? ReadOpenApiExportPath(string[] args)
    {
        const string exportSwitch = "--export-openapi";

        for (var index = 0; index < args.Length; index++)
        {
            if (!string.Equals(args[index], exportSwitch, StringComparison.Ordinal))
                continue;

            if (index + 1 >= args.Length || string.IsNullOrWhiteSpace(args[index + 1]))
                throw new ArgumentException($"{exportSwitch} requires a file path after it.", nameof(args));

            return Path.GetFullPath(args[index + 1]);
        }

        return null;
    }

    private static bool IsProbePath(PathString path) =>
        path.StartsWithSegments("/healthz") || path.StartsWithSegments("/readyz");
}