// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories.CityAreas;
using Core.Spatial;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using NetTopologySuite.Geometries;

namespace UnitTests.RepositoryTests;

public class CityAreaBoundaryRepositoryTests : TestBase
{
    private const int AreaId = 100;
    private const string AreaIdentifier = "area-boundary-test";

    private const int InsideTrail = 101;
    private const int MostlyOutsideTrail = 102;
    private const int FarTrail = 103;
    private const int ManualFarTrail = 104;
    private const int ContributionTrail = 105;

    private const int InsideFacility = 201;
    private const int OutsideFacility = 202;
    private const int UnplacedFacility = 203;

    private static MultiPolygon Square()
    {
        IReadOnlyList<Coordinate> ring =
            [new(20.00, 65.00), new(20.10, 65.00), new(20.10, 65.10), new(20.00, 65.10), new(20.00, 65.00)];

        return GeoPointFactory.FromLonLatPolygons([[ring]]);
    }

    private static Trail MakeTrail(int id, params (double Lon, double Lat)[] path)
    {
        return new Trail
        {
            Id = id,
            Identifier = $"trail-{id}",
            Name = $"Led {id}",
            TrailLength = 1m,
            GeoPath = GeoPointFactory.FromLonLatPath(path.Select(p => new Coordinate(p.Lon, p.Lat))),
        };
    }

    private static Facility MakeFacility(int id, Point? coordinates)
    {
        return new Facility
        {
            Id = id,
            Identifier = $"facility-{id}",
            Name = $"Plats {id}",
            FacilityType = FacilityType.FirePit,
            Coordinates = coordinates,
        };
    }

    private static void Seed(StigViddDbContext db)
    {
        db.CityAreas.Add(new CityArea { Id = AreaId, Identifier = AreaIdentifier, Name = "Testområdet", Location = "Norr" });

        db.Trails.AddRange(
            MakeTrail(InsideTrail, (20.02, 65.05), (20.08, 65.05)),
            MakeTrail(MostlyOutsideTrail, (20.09, 65.05), (20.30, 65.05)),
            MakeTrail(FarTrail, (21.00, 66.00), (21.10, 66.00)),
            MakeTrail(ManualFarTrail, (21.00, 66.10), (21.10, 66.10)),
            MakeTrail(ContributionTrail, (20.03, 65.06), (20.07, 65.06)));
        db.Set<TrailContribution>().Add(new TrailContribution { TrailId = ContributionTrail });

        db.Facilities.AddRange(
            MakeFacility(InsideFacility, GeoPointFactory.FromLonLat(20.05, 65.05)),
            MakeFacility(OutsideFacility, GeoPointFactory.FromLonLat(20.50, 65.50)),
            MakeFacility(UnplacedFacility, null));

        AddLink(db, "CityAreaTrail", "TrailId", FarTrail, manual: false);
        AddLink(db, "CityAreaTrail", "TrailId", ManualFarTrail, manual: true);
        AddLink(db, "CityAreaFacility", "FacilityId", UnplacedFacility, manual: false);
    }

    private static void AddLink(StigViddDbContext db, string table, string key, int id, bool manual)
    {
        db.Set<Dictionary<string, object>>(table).Add(
            new Dictionary<string, object> { ["CityAreaId"] = AreaId, [key] = id, ["IsManual"] = manual });
    }

    private static (CityAreaRepository Repo, IDbContextFactory<StigViddDbContext> Factory) Build()
    {
        var factory = CreateSeededFactory(Seed);

        return (new CityAreaRepository(factory, NullLogger<CityAreaRepository>.Instance), factory);
    }

    private static async Task<HashSet<int>> LinkedAsync(IDbContextFactory<StigViddDbContext> factory, string table, string key)
    {
        var ct = TestContext.Current.CancellationToken;
        await using var context = await factory.CreateDbContextAsync(ct);

        return (await context.Set<Dictionary<string, object>>(table)
            .Where(l => EF.Property<int>(l, "CityAreaId") == AreaId)
            .Select(l => EF.Property<int>(l, key))
            .ToListAsync(ct)).ToHashSet();
    }

    private static Task<HashSet<int>> LinkedTrailsAsync(IDbContextFactory<StigViddDbContext> factory)
    {
        return LinkedAsync(factory, "CityAreaTrail", "TrailId");
    }

    private static Task<HashSet<int>> LinkedFacilitiesAsync(IDbContextFactory<StigViddDbContext> factory)
    {
        return LinkedAsync(factory, "CityAreaFacility", "FacilityId");
    }

    [Fact]
    public async Task SaveBoundaryAsync_LinksWhatLiesInsideAndDropsBoundaryLinksOutside()
    {
        // Arrange
        var (repo, factory) = Build();

        // Act
        var result = await repo.SaveBoundaryAsync(AreaIdentifier, Square(), TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        (await LinkedTrailsAsync(factory)).Should().BeEquivalentTo([InsideTrail, ManualFarTrail]);
        (await LinkedFacilitiesAsync(factory)).Should().BeEquivalentTo([InsideFacility, UnplacedFacility]);
    }

    [Fact]
    public async Task SaveBoundaryAsync_NeverLinksAContribution()
    {
        // Arrange
        var (repo, factory) = Build();

        // Act
        await repo.SaveBoundaryAsync(AreaIdentifier, Square(), TestContext.Current.CancellationToken);

        // Assert
        (await LinkedTrailsAsync(factory)).Should().NotContain(ContributionTrail);
    }

    [Fact]
    public async Task GetBoundarySuggestionSourcesAsync_ReturnsLinkedPathsAndPositions_ButNoContribution()
    {
        // Arrange
        var factory = CreateSeededFactory(db =>
        {
            Seed(db);
            AddLink(db, "CityAreaTrail", "TrailId", ContributionTrail, manual: false);
            AddLink(db, "CityAreaFacility", "FacilityId", InsideFacility, manual: true);
        });
        var repo = new CityAreaRepository(factory, NullLogger<CityAreaRepository>.Instance);

        // Act
        var result = await repo.GetBoundarySuggestionSourcesAsync(AreaIdentifier, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var sources = result.Value;
        sources.Should().NotBeNull();
        sources.Paths.Select(p => p.Coordinates[0].Y).Should().BeEquivalentTo([66.00, 66.10]);
        sources.Points.Should().ContainSingle().Which.X.Should().Be(20.05);
    }

    [Fact]
    public async Task PreviewBoundaryAsync_ListsWhatSavingWouldAddAndRemove_AndSavesNothing()
    {
        // Arrange
        var (repo, factory) = Build();
        var ct = TestContext.Current.CancellationToken;

        // Act
        var result = await repo.PreviewBoundaryAsync(AreaIdentifier, Square(), ct);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var preview = result.Value;
        preview.Should().NotBeNull();
        var added = preview.AddedTrails.Should().ContainSingle().Subject;
        added.Identifier.Should().Be($"trail-{InsideTrail}");
        added.ShareInside.Should().BeApproximately(1.0, 0.001);
        preview.RemovedTrails.Select(t => t.Identifier).Should().Equal($"trail-{FarTrail}");
        preview.AddedFacilities.Select(f => f.Identifier).Should().Equal($"facility-{InsideFacility}");
        preview.RemovedFacilities.Should().BeEmpty();
        (await LinkedTrailsAsync(factory)).Should().BeEquivalentTo([FarTrail, ManualFarTrail]);
        (await LinkedFacilitiesAsync(factory)).Should().BeEquivalentTo([UnplacedFacility]);
    }

    [Fact]
    public async Task PreviewBoundaryAsync_LeavesOutAnExcludedTrail()
    {
        // Arrange
        var factory = CreateSeededFactory(db =>
        {
            Seed(db);
            db.CityAreaTrailExclusions.Add(new CityAreaTrailExclusion { CityAreaId = AreaId, TrailId = InsideTrail });
        });
        var repo = new CityAreaRepository(factory, NullLogger<CityAreaRepository>.Instance);

        // Act
        var result = await repo.PreviewBoundaryAsync(AreaIdentifier, Square(), TestContext.Current.CancellationToken);

        // Assert
        var preview = result.Value;
        preview.Should().NotBeNull();
        preview.AddedTrails.Should().BeEmpty();
    }

    [Fact]
    public async Task PreviewBoundaryAsync_MatchesWhatSavingDoes()
    {
        // Arrange
        var (repo, factory) = Build();
        var ct = TestContext.Current.CancellationToken;
        var before = await LinkedTrailsAsync(factory);
        var preview = (await repo.PreviewBoundaryAsync(AreaIdentifier, Square(), ct)).Value;
        preview.Should().NotBeNull();

        // Act
        await repo.SaveBoundaryAsync(AreaIdentifier, Square(), ct);

        // Assert
        var after = await LinkedTrailsAsync(factory);
        after.Except(before).Select(id => $"trail-{id}").Should().BeEquivalentTo(preview.AddedTrails.Select(t => t.Identifier));
        before.Except(after).Select(id => $"trail-{id}").Should().BeEquivalentTo(preview.RemovedTrails.Select(t => t.Identifier));
    }

    [Fact]
    public async Task GetBoundarySuggestionSourcesAsync_UnknownArea_IsNotFound()
    {
        // Arrange
        var (repo, _) = Build();

        // Act
        var result = await repo.GetBoundarySuggestionSourcesAsync("no-such-area", TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task SaveBoundaryAsync_LeavesAnExistingLinkToAContributionAlone()
    {
        // Arrange
        var factory = CreateSeededFactory(db =>
        {
            Seed(db);
            AddLink(db, "CityAreaTrail", "TrailId", ContributionTrail, manual: false);
        });
        var repo = new CityAreaRepository(factory, NullLogger<CityAreaRepository>.Instance);
        var ct = TestContext.Current.CancellationToken;

        // Act
        await repo.SaveBoundaryAsync(AreaIdentifier, Square(), ct);
        await repo.RecalculateTrailsAsync([ContributionTrail], ct);

        // Assert
        (await LinkedTrailsAsync(factory)).Should().Contain(ContributionTrail);
    }

    [Fact]
    public async Task RecalculateFacilitiesAsync_LeavesTheLinksOfAFacilityWithoutAPosition()
    {
        // Arrange
        var (repo, factory) = Build();
        var ct = TestContext.Current.CancellationToken;
        await repo.SaveBoundaryAsync(AreaIdentifier, Square(), ct);

        // Act
        await repo.RecalculateFacilitiesAsync([UnplacedFacility], ct);

        // Assert
        (await LinkedFacilitiesAsync(factory)).Should().Contain(UnplacedFacility);
    }

    [Fact]
    public async Task SaveBoundaryAsync_WithNull_KeepsOnlyManualLinksAndPlacesWithoutAPosition()
    {
        // Arrange
        var (repo, factory) = Build();
        var ct = TestContext.Current.CancellationToken;
        await repo.SaveBoundaryAsync(AreaIdentifier, Square(), ct);

        // Act
        await repo.SaveBoundaryAsync(AreaIdentifier, null, ct);

        // Assert
        (await LinkedTrailsAsync(factory)).Should().BeEquivalentTo([ManualFarTrail]);
        (await LinkedFacilitiesAsync(factory)).Should().BeEquivalentTo([UnplacedFacility]);
    }

    [Fact]
    public async Task UnlinkingABoundaryTrail_ExcludesIt_SoRecalculationLeavesItOut()
    {
        // Arrange
        var (repo, factory) = Build();
        var ct = TestContext.Current.CancellationToken;
        await repo.SaveBoundaryAsync(AreaIdentifier, Square(), ct);

        // Act
        await repo.SetTrailLinkAsync(AreaIdentifier, $"trail-{InsideTrail}", linked: false, ct);
        await repo.RecalculateAllAsync(ct);
        await repo.RecalculateTrailsAsync([InsideTrail], ct);

        // Assert
        (await LinkedTrailsAsync(factory)).Should().NotContain(InsideTrail);
        await using var context = await factory.CreateDbContextAsync(ct);
        (await context.CityAreaTrailExclusions.SingleAsync(ct)).TrailId.Should().Be(InsideTrail);
    }

    [Fact]
    public async Task RemoveTrailExclusionAsync_BringsTheTrailBack()
    {
        // Arrange
        var (repo, factory) = Build();
        var ct = TestContext.Current.CancellationToken;
        await repo.SaveBoundaryAsync(AreaIdentifier, Square(), ct);
        await repo.SetTrailLinkAsync(AreaIdentifier, $"trail-{InsideTrail}", linked: false, ct);

        // Act
        await repo.RemoveTrailExclusionAsync(AreaIdentifier, $"trail-{InsideTrail}", ct);

        // Assert
        (await LinkedTrailsAsync(factory)).Should().Contain(InsideTrail);
        await using var context = await factory.CreateDbContextAsync(ct);
        (await context.CityAreaTrailExclusions.AnyAsync(ct)).Should().BeFalse();
    }

    [Fact]
    public async Task UnlinkingAManualTrailOutsideTheBoundary_RemovesItWithoutAnExclusion()
    {
        // Arrange
        var (repo, factory) = Build();
        var ct = TestContext.Current.CancellationToken;
        await repo.SaveBoundaryAsync(AreaIdentifier, Square(), ct);

        // Act
        await repo.SetTrailLinkAsync(AreaIdentifier, $"trail-{ManualFarTrail}", linked: false, ct);

        // Assert
        (await LinkedTrailsAsync(factory)).Should().NotContain(ManualFarTrail);
        await using var context = await factory.CreateDbContextAsync(ct);
        (await context.CityAreaTrailExclusions.AnyAsync(ct)).Should().BeFalse();
    }

    [Fact]
    public async Task LinkingByHand_SurvivesRecalculationAndLiftsAnExclusion()
    {
        // Arrange
        var (repo, factory) = Build();
        var ct = TestContext.Current.CancellationToken;
        await repo.SaveBoundaryAsync(AreaIdentifier, Square(), ct);
        await repo.SetFacilityLinkAsync(AreaIdentifier, $"facility-{InsideFacility}", linked: false, ct);

        // Act
        await repo.SetFacilityLinkAsync(AreaIdentifier, $"facility-{InsideFacility}", linked: true, ct);
        await repo.SetFacilityLinkAsync(AreaIdentifier, $"facility-{OutsideFacility}", linked: true, ct);
        await repo.RecalculateAllAsync(ct);

        // Assert
        (await LinkedFacilitiesAsync(factory)).Should().BeEquivalentTo([InsideFacility, OutsideFacility, UnplacedFacility]);
        await using var context = await factory.CreateDbContextAsync(ct);
        (await context.CityAreaFacilityExclusions.AnyAsync(ct)).Should().BeFalse();
    }

    [Fact]
    public async Task RecalculateFacilitiesAsync_FollowsAFacilityThatMovedIn()
    {
        // Arrange
        var (repo, factory) = Build();
        var ct = TestContext.Current.CancellationToken;
        await repo.SaveBoundaryAsync(AreaIdentifier, Square(), ct);
        await using (var move = await factory.CreateDbContextAsync(ct))
        {
            var facility = await move.Facilities.SingleAsync(f => f.Id == OutsideFacility, ct);
            facility.Coordinates = GeoPointFactory.FromLonLat(20.06, 65.06);
            await move.SaveChangesAsync(ct);
        }

        // Act
        var result = await repo.RecalculateFacilitiesAsync([OutsideFacility], ct);

        // Assert
        result.IsSuccess.Should().BeTrue();
        (await LinkedFacilitiesAsync(factory)).Should().Contain(OutsideFacility);
    }

    [Fact]
    public async Task RecalculateTrailsAsync_LeavesTheLinksOfAnAreaWithoutABoundary()
    {
        // Arrange
        var (repo, factory) = Build();

        // Act
        await repo.RecalculateTrailsAsync([FarTrail], TestContext.Current.CancellationToken);

        // Assert
        (await LinkedTrailsAsync(factory)).Should().Contain(FarTrail);
    }

    [Fact]
    public async Task GetAllForAdminAsync_ShowsTheBoundaryWhereEachLinkCameFromAndTheExclusions()
    {
        // Arrange
        var (repo, _) = Build();
        var ct = TestContext.Current.CancellationToken;
        await repo.SaveBoundaryAsync(AreaIdentifier, Square(), ct);
        await repo.SetFacilityLinkAsync(AreaIdentifier, $"facility-{InsideFacility}", linked: false, ct);

        // Act
        var result = await repo.GetAllForAdminAsync(ct);

        // Assert
        result.IsSuccess.Should().BeTrue();
        var area = result.Value.Should().ContainSingle(a => a.Identifier == AreaIdentifier).Subject;
        (area.Boundary is not null).Should().BeTrue();
        area.Trails.Should().Contain(t => t.Identifier == $"trail-{ManualFarTrail}" && t.IsManual);
        area.Trails.Should().Contain(t => t.Identifier == $"trail-{InsideTrail}" && !t.IsManual);
        area.ExcludedFacilities.Should().ContainSingle().Which.Identifier.Should().Be($"facility-{InsideFacility}");
    }
}
