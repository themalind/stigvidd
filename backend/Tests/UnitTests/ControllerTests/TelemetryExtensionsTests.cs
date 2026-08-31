// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Microsoft.Extensions.Configuration;
using StigviddAPI.Extensions;
using System.Text;

namespace UnitTests.ControllerTests;

/// <summary>
/// The exporter's credentials are assembled once, at registration, and a wrong header is
/// then invisible: OTLP export failures never surface as application errors, so the only
/// symptom of getting this wrong is telemetry that silently never arrives.
///
/// What makes the precedence worth pinning is that the two credential forms are NOT
/// interchangeable. Otlp:Token is an ingestion token — base64("user:passcode") — and on
/// OpenObserve OSS, which has no RBAC, it is the only thing that limits a credential to
/// ingest. Otlp:Password is a login password, which on the same server reads every stream
/// and creates admin users. Encoding a token a second time, or letting a stale
/// username/password win over a configured token, both downgrade the credential silently.
/// </summary>
public class TelemetryExtensionsTests
{
    private static IConfiguration Configuration(params (string Key, string Value)[] settings) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(settings.Select(s => new KeyValuePair<string, string?>(s.Key, s.Value)))
            .Build();

    private static string Base64(string value) => Convert.ToBase64String(Encoding.UTF8.GetBytes(value));

    [Fact]
    public void BuildAuthHeader_WithAnIngestionToken_ShouldPassItThroughWithoutReEncodingIt()
    {
        // Arrange — what OpenObserve's Ingestion page prints is already base64.
        var token = Base64("api@stigvidd.se:o2oi_HPogYVQWRs6lnnvXVevsE7iNPM1tqxv2");
        var configuration = Configuration(("Otlp:Token", token));

        // Act
        var header = TelemetryExtensions.BuildAuthHeader(configuration);

        // Assert
        header.Should().Be($"Authorization=Basic {token}");
    }

    [Fact]
    public void BuildAuthHeader_ForATokenPastedWithSurroundingWhitespace_ShouldStillBeUsable()
    {
        // Arrange — copied out of a UI, this routinely arrives with a trailing newline, and
        // the header must not carry it into the request.
        var token = Base64("api@stigvidd.se:passcode");
        var configuration = Configuration(("Otlp:Token", $"  {token}\n"));

        // Act
        var header = TelemetryExtensions.BuildAuthHeader(configuration);

        // Assert
        header.Should().Be($"Authorization=Basic {token}");
    }

    [Fact]
    public void BuildAuthHeader_WithBothATokenAndAPassword_ShouldPreferTheToken()
    {
        // Arrange — a host that still carries the old OTLP_USER/OTLP_PASSWORD pair after
        // being moved onto a token must not keep sending the full-admin credential.
        var token = Base64("api@stigvidd.se:passcode");
        var configuration = Configuration(
            ("Otlp:Token", token),
            ("Otlp:Username", "root@stigvidd.se"),
            ("Otlp:Password", "the-admin-password"));

        // Act
        var header = TelemetryExtensions.BuildAuthHeader(configuration);

        // Assert
        header.Should().Be($"Authorization=Basic {token}");
        header.Should().NotContain(Base64("root@stigvidd.se:the-admin-password"));
    }

    [Fact]
    public void BuildAuthHeader_WithAVerbatimHeaderString_ShouldOutrankTheToken()
    {
        // Arrange
        var configuration = Configuration(
            ("Otlp:Headers", "Authorization=Basic verbatim"),
            ("Otlp:Token", Base64("api@stigvidd.se:passcode")));

        // Act
        var header = TelemetryExtensions.BuildAuthHeader(configuration);

        // Assert
        header.Should().Be("Authorization=Basic verbatim");
    }

    [Fact]
    public void BuildAuthHeader_WithOnlyAUsernameAndPassword_ShouldEncodeThemForLocalDevelopment()
    {
        // Arrange
        var configuration = Configuration(
            ("Otlp:Username", "dev@stigvidd.se"),
            ("Otlp:Password", "DevDev#123"));

        // Act
        var header = TelemetryExtensions.BuildAuthHeader(configuration);

        // Assert
        header.Should().Be($"Authorization=Basic {Base64("dev@stigvidd.se:DevDev#123")}");
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("api@stigvidd.se", null)]   // half a pair is not a credential
    [InlineData(null, "a-password")]
    [InlineData("api@stigvidd.se", "   ")]  // whitespace is not a password
    public void BuildAuthHeader_WithNoUsableCredential_ShouldThrowRatherThanExportUnauthenticated(
        string? user,
        string? password)
    {
        // Arrange
        var configuration = Configuration(("Otlp:Username", user!), ("Otlp:Password", password!));

        // Act
        var act = () => TelemetryExtensions.BuildAuthHeader(configuration);

        // Assert — naming the setting is the whole value of the throw; a 401 per batch is
        // otherwise indistinguishable from telemetry being switched off.
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Otlp:Token*");
    }
}
