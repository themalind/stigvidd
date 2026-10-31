// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core;
using Core.Interfaces.Repositories;
using Core.Telemetry;
using Infrastructure.Enums;
using Microsoft.Extensions.DependencyInjection;

namespace UnitTests.RepositoryTests;

public class ReportableContentHandlersTests
{
    private static List<IReportableContentHandler> Registered()
    {
        var services = new ServiceCollection();
        services.AddStigVidd("DataSource=:memory:");

        using var provider = services.BuildServiceProvider();
        return provider.GetServices<IReportableContentHandler>().ToList();
    }

    [Fact]
    public void EveryReportedContentType_HasExactlyOneRegisteredHandler()
    {
        var types = Registered().Select(h => h.ContentType).ToList();

        types.Should().OnlyHaveUniqueItems();
        types.Should().BeEquivalentTo(Enum.GetValues<ReportedContentType>().Where(t => t != ReportedContentType.Unknown));
    }

    [Fact]
    public void EveryHandler_HasItsOwnMetricTag()
    {
        var tags = Registered().Select(h => h.MetricTag).ToList();

        tags.Should().OnlyHaveUniqueItems();
        tags.Should().NotContain(t => string.IsNullOrWhiteSpace(t) || t == MetricTags.Values.ContentTypeUnknown);
    }
}
