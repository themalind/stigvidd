// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services.Events;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace UnitTests.ServiceTests;

public class EventLimitsTests
{
    private static EventLimits Resolve(Dictionary<string, string?> values)
    {
        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(new ConfigurationBuilder().AddInMemoryCollection(values).Build());
        EventLimits.Register(services);

        using var provider = services.BuildServiceProvider();
        return provider.GetRequiredService<IOptions<EventLimits>>().Value;
    }

    [Fact]
    public void Register_BindsTheEventsSection()
    {
        var limits = Resolve(new Dictionary<string, string?>
        {
            ["Events:UpcomingAsOrganizer"] = "7",
            ["Events:CreatedPerDay"] = "4",
            ["Events:CreatedPerDayWindow"] = "12:00:00",
        });

        limits.UpcomingAsOrganizer.Should().Be(7);
        limits.CreatedPerDay.Should().Be(4);
        limits.CreatedPerDayWindow.Should().Be(TimeSpan.FromHours(12));
    }

    [Fact]
    public void Register_WithoutTheSection_KeepsTheDefaults()
    {
        var limits = Resolve([]);

        limits.UpcomingAsOrganizer.Should().Be(5);
        limits.CreatedPerDay.Should().Be(3);
        limits.CreatedPerDayWindow.Should().Be(TimeSpan.FromDays(1));
    }

    [Theory]
    [InlineData("Events:UpcomingAsOrganizer", "0")]
    [InlineData("Events:CreatedPerDay", "-1")]
    [InlineData("Events:CreatedPerDayWindow", "00:00:00")]
    [InlineData("Events:InvitedPerDay", "0")]
    [InlineData("Events:InvitedPerDayWindow", "00:00:00")]
    [InlineData("Events:PostsPerMinute", "0")]
    [InlineData("Events:PostPushThrottle", "-00:01:00")]
    public void Register_WithAValueThatIsNotAboveZero_Throws(string key, string value)
    {
        var act = () => Resolve(new Dictionary<string, string?> { [key] = value });

        act.Should().Throw<OptionsValidationException>().WithMessage($"*{key}*");
    }
}
