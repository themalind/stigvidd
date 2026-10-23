// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;

namespace IntegrationTests.Repositories;

// Raw INSERT ... ON CONFLICT, which the unit tests' in-memory provider cannot run. keep-comment: why these are not unit tests
public class HikeShareRepositoryIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    // Seeded: VandrarVennen shared Hike 3 with NaturElskaren, Accepted. keep-comment: the conflict test relies on this seed row
    private const int Hike3 = 3;
    private const int NaturElskaren = 1;
    private const int VandrarVennen = 2;
    private const int SkogsGreven = 3;
    private const int Eremiten = 4;

    public HikeShareRepositoryIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private static (IHikeShareRepository Repo, IDbContextFactory<StigViddDbContext> Db) Resolve(IServiceScope scope) =>
        (scope.ServiceProvider.GetRequiredService<IHikeShareRepository>(),
         scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>());

    [Fact]
    public async Task ShareHikesAsync_InsertsEveryRowWithItsValues()
    {
        using var scope = _factory.Services.CreateScope();
        var (repo, db) = Resolve(scope);
        var ctoken = TestContext.Current.CancellationToken;

        var result = await repo.ShareHikesAsync(
        [
            new HikeShare { HikeId = Hike3, SharedById = NaturElskaren, SharedWithId = Eremiten, AllowResharing = true },
            new HikeShare { HikeId = Hike3, SharedById = NaturElskaren, SharedWithId = SkogsGreven },
            new HikeShare { HikeId = Hike3, SharedById = null, SharedWithId = VandrarVennen },
        ], ctoken);

        result.IsSuccess.Should().BeTrue();
        await using var context = await db.CreateDbContextAsync(ctoken);
        var rows = await context.HikeShares.AsNoTracking()
            .Where(hs => hs.HikeId == Hike3 && hs.SharedWithId != NaturElskaren)
            .OrderBy(hs => hs.SharedWithId)
            .ToListAsync(ctoken);
        rows.Select(r => (r.SharedWithId, r.SharedById, r.AllowResharing, r.Status))
            .Should().Equal(
                (VandrarVennen, (int?)null, false, HikeShareStatus.Pending),
                (SkogsGreven, NaturElskaren, false, HikeShareStatus.Pending),
                (Eremiten, NaturElskaren, true, HikeShareStatus.Pending));
    }

    [Fact]
    public async Task ShareHikesAsync_WhenARecipientAlreadyHasTheHike_InsertsTheRestAndKeepsTheExistingRow()
    {
        using var scope = _factory.Services.CreateScope();
        var (repo, db) = Resolve(scope);
        var ctoken = TestContext.Current.CancellationToken;

        var result = await repo.ShareHikesAsync(
        [
            new HikeShare { HikeId = Hike3, SharedById = Eremiten, SharedWithId = NaturElskaren },
            new HikeShare { HikeId = Hike3, SharedById = NaturElskaren, SharedWithId = Eremiten },
        ], ctoken);

        result.IsSuccess.Should().BeTrue();
        await using var context = await db.CreateDbContextAsync(ctoken);
        var existing = await context.HikeShares.AsNoTracking()
            .SingleAsync(hs => hs.HikeId == Hike3 && hs.SharedWithId == NaturElskaren, ctoken);
        existing.SharedById.Should().Be(VandrarVennen);
        existing.Status.Should().Be(HikeShareStatus.Accepted);
        (await context.HikeShares.AnyAsync(hs => hs.HikeId == Hike3 && hs.SharedWithId == Eremiten, ctoken))
            .Should().BeTrue();
    }
}
