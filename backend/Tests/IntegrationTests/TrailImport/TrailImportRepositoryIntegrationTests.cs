using Core.TrailImport.Matching;
using Core.Interfaces.Repositories;
using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NetTopologySuite.Geometries;
using StigviddAPI;

namespace IntegrationTests.TrailImport;

/// <summary>
/// The analysis writes one proposal per feature, 203 of them carrying full geometry, so
/// they go in a batch at a time inside a single transaction. Covered here rather than in
/// the unit tests because the in-memory provider has neither ExecuteDelete nor
/// transactions.
/// </summary>
public class TrailImportRepositoryIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    // More than two batches, so the loop is exercised and the last one is partial.
    private const int MoreThanOneBatch = 45;

    public TrailImportRepositoryIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private static TrailImportProposal Proposal(int index) => new()
    {
        ExternalId = index.ToString(),
        FeatureName = $"Feature {index}",
        GeometryFingerprint = index.ToString("x64"),
        // SRID 4326 via GeoPointFactory, like the seeded trails — SpatiaLite enforces the
        // column's SRID on insert, so an SRID-0 line here would be rejected.
        FeatureGeometry = GeoPointFactory.FromLonLatPath(
        [
            new Coordinate(12.805, 57.621 + index / 1000.0),
            new Coordinate(12.806, 57.622 + index / 1000.0),
        ]),
        Confidence = MatchConfidence.Unmatched,
        Decision = ProposalDecision.Pending,
    };

    private static int CreateSession(StigViddDbContext context, string fileName,
        ImportSessionStatus status = ImportSessionStatus.Uploaded)
    {
        var session = new TrailImportSession
        {
            Source = "boras-stad",
            FileName = fileName,
            FileSizeBytes = 21_500_000,
            FileHash = new string('a', 64),
            StoredPath = $"/media/imports/{fileName}",
            Status = status,
        };

        context.TrailImportSessions.Add(session);
        context.SaveChanges();

        return session.Id;
    }

    private (ITrailImportRepository Repository, IDbContextFactory<StigViddDbContext> Factory) Resolve()
    {
        var scope = _factory.Services.CreateScope();

        return (scope.ServiceProvider.GetRequiredService<ITrailImportRepository>(),
                scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>());
    }

    [Fact]
    public async Task ReplaceProposalsAsync_ForMoreProposalsThanFitOneBatch_ShouldWriteEveryOne()
    {
        // Arrange
        var (repository, contextFactory) = Resolve();
        using var context = contextFactory.CreateDbContext();
        var sessionId = CreateSession(context, "spar_leder.json");

        var proposals = Enumerable.Range(1, MoreThanOneBatch).Select(Proposal).ToList();

        // Act
        var result = await repository.ReplaceProposalsAsync(sessionId, proposals, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var written = await context.TrailImportProposals
            .AsNoTracking()
            .Where(p => p.SessionId == sessionId)
            .ToListAsync(TestContext.Current.CancellationToken);

        written.Should().HaveCount(MoreThanOneBatch);
        written.Select(p => p.ExternalId).Should().BeEquivalentTo(proposals.Select(p => p.ExternalId));
        written.Should().OnlyContain(p => p.FeatureGeometry != null);
    }

    [Fact]
    public async Task ReplaceProposalsAsync_WhenTheAnalysisIsRerun_ShouldReplaceRatherThanAdd()
    {
        // Arrange
        var (repository, contextFactory) = Resolve();
        using var context = contextFactory.CreateDbContext();
        var sessionId = CreateSession(context, "spar_leder.json");

        await repository.ReplaceProposalsAsync(sessionId,
            [.. Enumerable.Range(1, MoreThanOneBatch).Select(Proposal)], TestContext.Current.CancellationToken);

        // Act — a shorter second run, so leftovers from the first would be visible.
        var result = await repository.ReplaceProposalsAsync(sessionId,
            [.. Enumerable.Range(100, 3).Select(Proposal)], TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var written = await context.TrailImportProposals
            .AsNoTracking()
            .Where(p => p.SessionId == sessionId)
            .ToListAsync(TestContext.Current.CancellationToken);

        written.Should().HaveCount(3);
        written.Select(p => p.ExternalId).Should().BeEquivalentTo(["100", "101", "102"]);
    }

    [Fact]
    public async Task ReplaceProposalsAsync_ShouldLeaveAnotherSessionsProposalsAlone()
    {
        // Arrange
        var (repository, contextFactory) = Resolve();
        using var context = contextFactory.CreateDbContext();
        var first = CreateSession(context, "spar_leder-2025.json");
        var second = CreateSession(context, "spar_leder-2026.json");

        await repository.ReplaceProposalsAsync(first,
            [.. Enumerable.Range(1, 5).Select(Proposal)], TestContext.Current.CancellationToken);

        // Act
        await repository.ReplaceProposalsAsync(second,
            [.. Enumerable.Range(1, MoreThanOneBatch).Select(Proposal)], TestContext.Current.CancellationToken);

        // Assert
        var untouched = await context.TrailImportProposals
            .AsNoTracking()
            .CountAsync(p => p.SessionId == first, TestContext.Current.CancellationToken);

        untouched.Should().Be(5);
    }

    [Fact]
    public async Task FailInterruptedSessionsAsync_ShouldMarkOnlyTheSessionsLeftMidAnalysis()
    {
        // Arrange — one session a restart cut short, one waiting for a reviewer.
        var (repository, contextFactory) = Resolve();
        using var context = contextFactory.CreateDbContext();

        var interrupted = CreateSession(context, "avbruten.json", ImportSessionStatus.Analyzing);
        var reviewing = CreateSession(context, "granskas.json", ImportSessionStatus.AwaitingReview);

        // Act
        var result = await repository.FailInterruptedSessionsAsync("The analysis was interrupted by a restart.",
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(1);

        var rows = await context.TrailImportSessions
            .AsNoTracking()
            .Where(s => s.Id == interrupted || s.Id == reviewing)
            .ToDictionaryAsync(s => s.Id, TestContext.Current.CancellationToken);

        rows[interrupted].Status.Should().Be(ImportSessionStatus.Failed);
        rows[interrupted].ErrorMessage.Should().Be("The analysis was interrupted by a restart.");
        rows[reviewing].Status.Should().Be(ImportSessionStatus.AwaitingReview);
        rows[reviewing].ErrorMessage.Should().BeNull();
    }

    [Fact]
    public async Task FailInterruptedSessionsAsync_WhenNothingWasInterrupted_ShouldMarkNothing()
    {
        // Arrange
        var (repository, contextFactory) = Resolve();
        using var context = contextFactory.CreateDbContext();

        CreateSession(context, "granskas.json", ImportSessionStatus.AwaitingReview);

        // Act
        var result = await repository.FailInterruptedSessionsAsync("The analysis was interrupted by a restart.",
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(0);
    }

    [Fact]
    public async Task GetExcludedFingerprintsAsync_ShouldReturnOnlyTheExclusionsForThatSource()
    {
        // Arrange — a fingerprint identifies a feature within one source, and only an
        // excluded link means the reviewer has already said no to it.
        var (repository, contextFactory) = Resolve();
        using var context = contextFactory.CreateDbContext();

        var excluded = Guid.NewGuid().ToString("N");
        var linked = Guid.NewGuid().ToString("N");
        var otherSource = Guid.NewGuid().ToString("N");

        context.TrailSourceLinks.AddRange(
            Link("boras-stad", excluded, TrailSourceLinkRole.Excluded),
            Link("boras-stad", linked, TrailSourceLinkRole.Segment),
            Link("harryda", otherSource, TrailSourceLinkRole.Excluded));

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await repository.GetExcludedFingerprintsAsync("boras-stad", TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Contain(excluded);
        result.Value.Should().NotContain([linked, otherSource]);
    }

    private static TrailSourceLink Link(string source, string fingerprint, TrailSourceLinkRole role) => new()
    {
        Source = source,
        GeometryFingerprint = fingerprint,
        Role = role,
        Confidence = MatchConfidence.Unmatched,
        ConfirmedByHuman = true,
        LastSeenAt = DateTime.UtcNow,
    };
}
