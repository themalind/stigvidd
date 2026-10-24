// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Unicode;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using StigviddLinks;
using StigviddLinks.Pages;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddOptions<AppLinksOptions>()
    .Bind(builder.Configuration.GetSection(AppLinksOptions.SectionName))
    .Validate(o => IsAbsoluteUrl(o.PublicBaseUrl) && IsAbsoluteUrl(o.SiteUrl),
        "AppLinks:PublicBaseUrl and AppLinks:SiteUrl must be absolute URLs.")
    .ValidateOnStart();

var apiBaseUrl = builder.Configuration["Api:BaseUrl"];
if (!IsAbsoluteUrl(apiBaseUrl))
    throw new InvalidOperationException("Api:BaseUrl must be an absolute URL.");

builder.Services.AddHttpClient<TrailClient>(client =>
{
    client.BaseAddress = new Uri(apiBaseUrl);
    client.Timeout = TimeSpan.FromSeconds(5);
});

builder.Services.AddRazorComponents();
builder.Services.AddSingleton(HtmlEncoder.Create(UnicodeRanges.All));

var app = builder.Build();

// .well-known files take no naming policy: their member names are fixed by Apple and Google. keep-comment: the web defaults would camelCase them
var wellKnownJson = new JsonSerializerOptions();

app.MapGet("/healthz", () => Results.Ok());

app.MapGet("/trail/{identifier}", async Task<IResult> (
    string identifier,
    string? lang,
    TrailClient trails,
    IOptions<AppLinksOptions> options,
    HttpRequest request,
    HttpResponse response,
    CancellationToken ctoken) =>
{
    var lookup = await trails.GetTrailAsync(identifier, ctoken);
    var texts = PageTexts.For(lang);
    var siteUrl = options.Value.SiteUrl;

    if (lookup is { Status: TrailLookupStatus.Found, Trail: { } trail })
    {
        response.Headers.CacheControl = "public, max-age=300";
        response.Headers.Vary = "User-Agent";
        var isAndroid = request.Headers.UserAgent.ToString().Contains("Android", StringComparison.OrdinalIgnoreCase);
        return new RazorComponentResult<TrailPage>(new { Trail = trail, Options = options.Value, Texts = texts, IsAndroid = isAndroid });
    }

    response.Headers.CacheControl = "no-store";
    var currentPath = request.Path.ToUriComponent();

    return lookup.Status == TrailLookupStatus.NotFound
        ? new RazorComponentResult<MessagePage>(new
        {
            Heading = texts.NotFoundHeading,
            Body = texts.NotFoundBody,
            SiteUrl = siteUrl,
            Texts = texts,
            CurrentPath = currentPath,
        }) { StatusCode = StatusCodes.Status404NotFound }
        : new RazorComponentResult<MessagePage>(new
        {
            Heading = texts.ErrorHeading,
            Body = texts.ErrorBody,
            SiteUrl = siteUrl,
            Texts = texts,
            CurrentPath = currentPath,
        }) { StatusCode = StatusCodes.Status503ServiceUnavailable };
});

app.MapGet("/.well-known/apple-app-site-association", (IOptions<AppLinksOptions> options) =>
    WellKnown.AppleAppSiteAssociation(options.Value) is { } body
        ? Results.Json(body, wellKnownJson)
        : Results.NotFound());

app.MapGet("/.well-known/assetlinks.json", (IOptions<AppLinksOptions> options) =>
    WellKnown.AssetLinks(options.Value) is { } body
        ? Results.Json(body, wellKnownJson)
        : Results.NotFound());

app.MapFallback((IOptions<AppLinksOptions> options) => Results.Redirect(options.Value.SiteUrl));

app.Run();

static bool IsAbsoluteUrl([System.Diagnostics.CodeAnalysis.NotNullWhen(true)] string? value) =>
    Uri.TryCreate(value, UriKind.Absolute, out _);

public partial class Program;
