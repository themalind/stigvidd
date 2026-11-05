// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using StigviddLinks;

namespace LinkTests;

public class LinkServiceFactory : WebApplicationFactory<Program>
{
    private readonly Dictionary<string, string?> _settings = new()
    {
        ["Api:BaseUrl"] = "http://api.test",
        ["AppLinks:PublicBaseUrl"] = "https://link.example.test",
        ["AppLinks:SiteUrl"] = "https://example.test",
        ["AppLinks:AppleTeamId"] = "",
        ["AppLinks:AppStoreUrl"] = "",
        ["AppLinks:PlayStoreUrl"] = "",
        ["AppLinks:AndroidTestUrl"] = "",
    };

    public StubApiHandler Api { get; } = new();

    public LinkServiceFactory With(string key, string value)
    {
        _settings[key] = value;
        return this;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        foreach (var (key, value) in _settings)
            builder.UseSetting(key, value);

        builder.ConfigureTestServices(services =>
            services.AddHttpClient<TrailClient>().ConfigurePrimaryHttpMessageHandler(() => Api));
    }

    public HttpClient CreateNonRedirectingClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
}
