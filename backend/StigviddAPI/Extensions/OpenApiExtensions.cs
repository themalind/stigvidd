// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NSwag;
using NSwag.Generation;
using NSwag.Generation.Processors.Security;

namespace StigviddAPI.Extensions;

public static class OpenApiExtensions
{
    private const string ExportSwitch = "--export-openapi";

    public static IServiceCollection AddStigviddOpenApi(this IServiceCollection services)
    {
        services.AddOpenApi();
        services.AddOpenApiDocument(config =>
        {
            config.Title = "StigVidd";

            // The AGPL section 13 source offer. orval copies this into every generated file, so
            // editing it means `cd web && npm run generate:api` and committing src/api/generated.
            config.Description =
                "Stigvidd API. This is free software, licensed under the GNU Affero General "
                + "Public License version 3 or later. Under section 13 of that licence you "
                + "are entitled to the Corresponding Source of this running service: "
                + "https://github.com/themalind/stigvidd";

            config.AddSecurity("Bearer", new OpenApiSecurityScheme
            {
                Type = OpenApiSecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = OpenApiSecurityApiKeyLocation.Header,
                Name = "Authorization",
                Description = "Skriv: Bearer {din Keycloak access token}"
            });

            config.OperationProcessors.Add(new OperationSecurityScopeProcessor("Bearer"));
        });

        return services;
    }

    // The absolute path after `--export-openapi`, or null when the switch is absent.
    public static string? ReadOpenApiExportPath(string[] args)
    {
        for (var index = 0; index < args.Length; index++)
        {
            if (!string.Equals(args[index], ExportSwitch, StringComparison.Ordinal))
            {
                continue;
            }

            if (index + 1 >= args.Length || string.IsNullOrWhiteSpace(args[index + 1]))
            {
                throw new ArgumentException($"{ExportSwitch} requires a file path after it.", nameof(args));
            }

            return Path.GetFullPath(args[index + 1]);
        }

        return null;
    }

    // Writes the same document /swagger/v1/swagger.json serves, with LF line endings on every OS.
    public static async Task ExportOpenApiDocumentAsync(this WebApplication app, string path)
    {
        var generator = app.Services.GetRequiredService<IOpenApiDocumentGenerator>();
        var document = await generator.GenerateAsync("v1");

        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        // ToJson() is CRLF on Windows; the client generated from it is committed (docs/notes/openapi-snapshot-fails-on-windows-line-endings.md).
        var json = document.ToJson().Replace("\r\n", "\n");
        await File.WriteAllTextAsync(path, json);

        Console.WriteLine($"Wrote {json.Length} characters of OpenAPI document to {path}");
    }
}
