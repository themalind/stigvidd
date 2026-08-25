using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StigviddAPI;

namespace IntegrationTests.Schema;

/// <summary>
/// Proves the guarantees TrailRelation claims are enforced by the SCHEMA, not merely by the
/// code that writes to it. The unit tests run on the EF InMemory provider, which honours
/// neither a unique index nor a check constraint nor a cascade, so a relation table that
/// lost its configuration would stay green there. Only a real relational provider answers
/// this, and SQLite enforces all three the same way PostGIS does.
/// </summary>
public class TrailRelationSchemaTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    public TrailRelationSchemaTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private StigViddDbContext NewContext()
    {
        using var scope = _factory.Services.CreateScope();
        return scope.ServiceProvider
            .GetRequiredService<IDbContextFactory<StigViddDbContext>>()
            .CreateDbContext();
    }

    private static async Task<(int parent, int child)> AddTwoTrailsAsync(
        StigViddDbContext context, string label, CancellationToken ct)
    {
        var parent = new Trail { Name = $"{label} parent", TrailLength = 100m };
        var child = new Trail { Name = $"{label} child", TrailLength = 10m };
        context.Trails.AddRange(parent, child);
        await context.SaveChangesAsync(ct);
        return (parent.Id, child.Id);
    }

    [Fact]
    public async Task SameRelationTwice_ShouldBeRejected()
    {
        // Arrange
        var ct = TestContext.Current.CancellationToken;
        using var context = NewContext();
        var (parent, child) = await AddTwoTrailsAsync(context, "duplicate", ct);

        context.TrailRelations.Add(new TrailRelation
        {
            FromTrailId = child, ToTrailId = parent, Type = TrailRelationType.PartOf, Sequence = 1
        });
        await context.SaveChangesAsync(ct);

        // Act — the same pair and type a second time, with a different sequence
        using var second = NewContext();
        second.TrailRelations.Add(new TrailRelation
        {
            FromTrailId = child, ToTrailId = parent, Type = TrailRelationType.PartOf, Sequence = 2
        });
        var act = async () => await second.SaveChangesAsync(ct);

        // Assert
        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task SamePairUnderAnotherType_ShouldBeAllowed()
    {
        // Arrange
        var ct = TestContext.Current.CancellationToken;
        using var context = NewContext();
        var (parent, child) = await AddTwoTrailsAsync(context, "two types", ct);

        // Act — the unique index covers the type, so the pair may carry more than one relation
        context.TrailRelations.AddRange(
            new TrailRelation { FromTrailId = child, ToTrailId = parent, Type = TrailRelationType.PartOf },
            new TrailRelation { FromTrailId = child, ToTrailId = parent, Type = TrailRelationType.Alternative });
        var act = async () => await context.SaveChangesAsync(ct);

        // Assert
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task TrailRelatedToItself_ShouldBeRejected()
    {
        // Arrange
        var ct = TestContext.Current.CancellationToken;
        using var context = NewContext();
        var (parent, _) = await AddTwoTrailsAsync(context, "self", ct);

        // Act
        context.TrailRelations.Add(new TrailRelation
        {
            FromTrailId = parent, ToTrailId = parent, Type = TrailRelationType.Alternative
        });
        var act = async () => await context.SaveChangesAsync(ct);

        // Assert
        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task DeletingEitherTrail_ShouldTakeTheRelationWithIt()
    {
        // Arrange — one relation per end, so both foreign keys are exercised
        var ct = TestContext.Current.CancellationToken;
        using var context = NewContext();
        var (parent, child) = await AddTwoTrailsAsync(context, "cascade from", ct);
        var (otherParent, otherChild) = await AddTwoTrailsAsync(context, "cascade to", ct);

        context.TrailRelations.AddRange(
            new TrailRelation { FromTrailId = child, ToTrailId = parent, Type = TrailRelationType.PartOf },
            new TrailRelation { FromTrailId = otherChild, ToTrailId = otherParent, Type = TrailRelationType.PartOf });
        await context.SaveChangesAsync(ct);

        // Act — delete the From end of one pair and the To end of the other
        using var deleting = NewContext();
        deleting.Trails.RemoveRange(
            await deleting.Trails.SingleAsync(t => t.Id == child, ct),
            await deleting.Trails.SingleAsync(t => t.Id == otherParent, ct));
        await deleting.SaveChangesAsync(ct);

        // Assert — no relation is left pointing at a trail that is gone
        using var reading = NewContext();
        var orphans = await reading.TrailRelations.AsNoTracking()
            .Where(r => r.FromTrailId == child || r.ToTrailId == otherParent)
            .ToListAsync(ct);
        orphans.Should().BeEmpty();
    }
}
