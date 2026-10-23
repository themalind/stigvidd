// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Services;

namespace UnitTests.ServiceTests;

public class HikeSubmissionSimilarRoutesTests
{
    private static readonly NetTopologySuite.Geometries.LineString Walk =
        Utilities.GeoPath((12.94, 57.72), (12.945, 57.72), (12.95, 57.72));

    [Fact]
    public void TheSameRouteRecordedAgain_IsALikelyDuplicate()
    {
        var again = new RoutePath("t-1", "Sjörundan", RouteKind.Contribution, Utilities.GeoPath((12.94, 57.72005), (12.95, 57.72005)));

        var similar = HikeSubmissionService.RankSimilar(Walk, [again]);

        var match = similar.Should().ContainSingle().Subject;
        match.Identifier.Should().Be("t-1");
        match.Kind.Should().Be("Contribution");
        match.LikelyDuplicate.Should().BeTrue();
        match.WalkOnRoute.Should().BeGreaterThan(0.95);
    }

    [Fact]
    public void AWalkAlongPartOfALongTrail_IsListedButNotADuplicate()
    {
        var longTrail = new RoutePath("t-2", "Långa leden", RouteKind.Trail, Utilities.GeoPath((12.93, 57.72), (12.97, 57.72)));

        var similar = HikeSubmissionService.RankSimilar(Walk, [longTrail]);

        var match = similar.Should().ContainSingle().Subject;
        match.WalkOnRoute.Should().BeGreaterThan(0.95);
        match.RouteOnWalk.Should().BeLessThan(0.5);
        match.LikelyDuplicate.Should().BeFalse();
    }

    [Fact]
    public void RoutesElsewhere_AreLeftOut()
    {
        var far = new RoutePath("t-3", "Annanstans", RouteKind.Trail, Utilities.GeoPath((13.5, 58.0), (13.51, 58.0)));
        var nearbyButApart = new RoutePath("t-4", "Parallell", RouteKind.Trail, Utilities.GeoPath((12.94, 57.722), (12.95, 57.722)));

        var similar = HikeSubmissionService.RankSimilar(Walk, [far, nearbyButApart]);

        similar.Should().BeEmpty();
    }

    [Fact]
    public void TheClosestMatchComesFirst()
    {
        var partial = new RoutePath("t-2", "Långa leden", RouteKind.Trail, Utilities.GeoPath((12.93, 57.72), (12.97, 57.72)));
        var same = new RoutePath("s-1", "Samma runda", RouteKind.Submission, Utilities.GeoPath((12.94, 57.72), (12.95, 57.72)));

        var similar = HikeSubmissionService.RankSimilar(Walk, [partial, same]);

        similar.Select(s => s.Identifier).Should().Equal("s-1", "t-2");
    }
}
