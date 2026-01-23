using Core;
using Core.Validators;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using SharpGrip.FluentValidation.AutoValidation.Mvc.Extensions;
using System.Text.Json;

namespace StigviddAPI;

public class Program
{
    private static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
         .AddJwtBearer(options =>
         {
             options.Authority = "https://securetoken.google.com/stigvidd-b4cd0";
             options.TokenValidationParameters = new TokenValidationParameters
             {
                 ValidateIssuer = true,
                 ValidateAudience = true,
                 ValidateLifetime = true,
                 ValidIssuer = "https://securetoken.google.com/stigvidd-b4cd0",
                 ValidAudience = "stigvidd-b4cd0",
             };
         });

        builder.Services.AddControllers()
        .AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        });

        builder.Services.AddFluentValidationAutoValidation();

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
                Description = "Skriv: Bearer {din Firebase idToken}"
            });

            config.OperationProcessors.Add(
                 new NSwag.Generation.Processors.Security.OperationSecurityScopeProcessor("Bearer")
            );
        });

        var app = builder.Build();

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