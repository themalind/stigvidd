// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Telemetry;
using Microsoft.Extensions.DependencyInjection;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;
using StigviddAPI;

namespace IntegrationTests.Telemetry;

/// <summary>
/// Pins the property that adding an application meter to Core must not quietly cost.
///
/// TelemetryExtensions registers OpenTelemetry only when Otlp:Endpoint is set. That guard is
/// what keeps a developer's local API host, CI and every one of these integration hosts free of
/// export threads and outbound connection attempts — and it is a REGISTRATION-time guard, so
/// nothing at runtime would report it being lost.
///
/// Core/Telemetry/StigviddMetrics.cs is registered unconditionally, which is safe precisely
/// because a Meter is a BCL type that registers nothing with OpenTelemetry. These tests are what
/// make that claim checkable instead of a comment: the instruments must exist, and the providers
/// must not.
/// </summary>
public class TelemetryOptInTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    public TelemetryOptInTests(StigViddWebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public void WithNoOtlpEndpoint_NoOpenTelemetryProvidersAreRegistered()
    {
        using var scope = _factory.Services.CreateScope();

        scope.ServiceProvider.GetService<MeterProvider>().Should().BeNull(
            "TelemetryExtensions must register no metrics provider without Otlp:Endpoint — a "
            + "provider here means every test host is running an exporter and its background "
            + "export thread");

        scope.ServiceProvider.GetService<TracerProvider>().Should().BeNull(
            "same guard, traces half");
    }

    [Fact]
    public void TheApplicationMetricsAreResolvable_EvenThoughExportIsOff()
    {
        using var scope = _factory.Services.CreateScope();

        // Resolving proves both halves of the registration: that AddStigVidd registers
        // StigviddMetrics, and that IMeterFactory is available to construct it. Without this a
        // service that takes StigviddMetrics would fail at its first request in production while
        // every unit test — which constructs services directly — stayed green.
        var metrics = scope.ServiceProvider.GetService<StigviddMetrics>();

        metrics.Should().NotBeNull();
    }

    [Fact]
    public void TheMetricsSingletonIsShared_SoInstrumentsAreNotRecreatedPerResolve()
    {
        // A Meter owns its instruments, so a transient registration would leak one set per
        // resolve. Two resolves must be the same object.
        var first = _factory.Services.GetRequiredService<StigviddMetrics>();
        var second = _factory.Services.GetRequiredService<StigviddMetrics>();

        second.Should().BeSameAs(first);
    }
}
