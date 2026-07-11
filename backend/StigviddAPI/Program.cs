using System.Globalization;
using System.Text.Json;
using Core;
using Core.Validators.User;
using Duende.AccessTokenManagement;
using FluentValidation;
using Infrastructure;
using Keycloak.AuthServices.Common;
using Keycloak.AuthServices.Sdk;
using Microsoft.AspNetCore.Http.Features;
using SharpGrip.FluentValidation.AutoValidation.Mvc.Extensions;

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
                            .WithOrigins("https://stigvidd.se")
                            .AllowAnyHeader()
                            .AllowAnyMethod();
                    }
                });
        });

        builder.Services.AddKeycloakWebApiAuthentication(builder.Configuration);
        builder.Services.AddAuthorization();

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
                logger.LogError(exception, "Unhandled exception");

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
            app.MapOpenApi();
        }

        app.UseHttpsRedirection();

        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllers();

        app.Run();
    }
}