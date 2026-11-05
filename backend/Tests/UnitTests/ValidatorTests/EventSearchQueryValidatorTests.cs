// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.Event;
using WebDataContracts.Enums;
using WebDataContracts.RequestModels.Event;

namespace UnitTests.ValidatorTests;

public class EventSearchQueryValidatorTests
{
    private readonly EventFeedQueryValidator _feed = new();
    private readonly MyEventsQueryValidator _mine = new();

    [Fact]
    public void AFullSearch_IsValid()
    {
        var query = new EventFeedQuery
        {
            Search = "kypesjön",
            From = new DateTime(2026, 11, 7, 0, 0, 0, DateTimeKind.Utc),
            To = new DateTime(2026, 11, 9, 0, 0, 0, DateTimeKind.Utc),
            Lat = 57.72m,
            Lon = 12.94m,
            RadiusKm = 25,
            OnlyWithSpots = true,
            MinLengthKm = 5,
            MaxLengthKm = 15,
            RouteKind = EventRouteKind.Trail,
            Sort = EventSort.Distance,
        };

        _feed.Validate(query).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Search_LongerThanTheLimit_IsRefused()
    {
        var query = new EventFeedQuery { Search = new string('a', EventSearchQuery.MaxSearchLength + 1) };

        _feed.Validate(query).IsValid.Should().BeFalse();
    }

    [Fact]
    public void SortByDistance_WithoutAPosition_IsRefused()
    {
        _feed.Validate(new EventFeedQuery { Sort = EventSort.Distance }).IsValid.Should().BeFalse();
    }

    [Fact]
    public void To_NotAfterFrom_IsRefused()
    {
        var at = new DateTime(2026, 11, 7, 0, 0, 0, DateTimeKind.Utc);

        _feed.Validate(new EventFeedQuery { From = at, To = at }).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData(-1, null)]
    [InlineData(null, 1001)]
    [InlineData(10, 5)]
    public void LengthBounds_OutOfRangeOrCrossed_AreRefused(int? min, int? max)
    {
        var query = new EventFeedQuery { MinLengthKm = min, MaxLengthKm = max };

        _feed.Validate(query).IsValid.Should().BeFalse();
    }

    [Fact]
    public void AnUnknownRouteKind_IsRefused()
    {
        _feed.Validate(new EventFeedQuery { RouteKind = (EventRouteKind)9 }).IsValid.Should().BeFalse();
    }

    [Fact]
    public void MyEvents_GetsTheSameRules()
    {
        _mine.Validate(new MyEventsQuery { Sort = EventSort.Distance }).IsValid.Should().BeFalse();
        _mine.Validate(new MyEventsQuery { Lat = 57.72m, Lon = 12.94m, Sort = EventSort.Distance, Past = true }).IsValid.Should().BeTrue();
    }
}
