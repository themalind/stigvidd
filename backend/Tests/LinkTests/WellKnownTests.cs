// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Net;
using System.Text.Json;
using AwesomeAssertions;

namespace LinkTests;

public class WellKnownTests
{
    private const string Aasa = "/.well-known/apple-app-site-association";
    private const string AssetLinks = "/.well-known/assetlinks.json";

    [Fact]
    public async Task The_apple_file_names_the_app_and_claims_only_trail_paths()
    {
        using var factory = new LinkServiceFactory().With("AppLinks:AppleTeamId", "ABCDE12345");

        var response = await factory.CreateClient().GetAsync(Aasa, TestContext.Current.CancellationToken);
        var json = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/json");
        var detail = JsonDocument.Parse(json).RootElement.GetProperty("applinks").GetProperty("details")[0];
        detail.GetProperty("appIDs")[0].GetString().Should().Be("ABCDE12345.com.stigvidd.app");
        detail.GetProperty("components")[0].GetProperty("/").GetString().Should().Be("/trail/*");
    }

    [Fact]
    public async Task Without_a_team_id_there_is_no_apple_file()
    {
        using var factory = new LinkServiceFactory();

        var response = await factory.CreateClient().GetAsync(Aasa, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task The_android_file_names_the_package_and_fingerprint()
    {
        using var factory = new LinkServiceFactory().With("AppLinks:AndroidSha256Fingerprints:0", "AA:BB");

        var response = await factory.CreateClient().GetAsync(AssetLinks, TestContext.Current.CancellationToken);
        var json = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var target = JsonDocument.Parse(json).RootElement[0].GetProperty("target");
        target.GetProperty("namespace").GetString().Should().Be("android_app");
        target.GetProperty("package_name").GetString().Should().Be("com.stigvidd.app");
        target.GetProperty("sha256_cert_fingerprints")[0].GetString().Should().Be("AA:BB");
    }

    [Fact]
    public async Task Without_a_fingerprint_there_is_no_android_file()
    {
        using var factory = new LinkServiceFactory();

        var response = await factory.CreateClient().GetAsync(AssetLinks, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
