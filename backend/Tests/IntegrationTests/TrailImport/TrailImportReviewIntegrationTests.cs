using Core.Common;
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
/// The reads and writes the review view runs on: paging the proposals, counting them, and
/// recording a decision. All of them use ExecuteUpdate, grouping or subqueries that the
/// in-memory provider does not translate, so they belong here.
/// </summary>
public class TrailImportReviewIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const int TivedenId = 1;
    private const int StorsjoledenId = 2;

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public TrailImportReviewIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private static readonly LineString Line = Geometry.DefaultFactory.CreateLineString(
    [
        new Coordinate(12.805, 57.621),
        new Coordinate(12.806, 57.622),
    ]);

    private (ITrailImportRepository Repository, StigViddDbContext Context) Resolve()
    {
        var scope = _factory.Services.CreateScope();
        var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>();

        return (scope.ServiceProvider.GetRequiredService<ITrailImportRepository>(), contextFactory.CreateDbContext());
    }

    private static int CreateSession(StigViddDbContext context, ImportSessionStatus status = ImportSessionStatus.AwaitingReview)
    {
        var session = new TrailImportSession
        {
            Source = "boras-stad",
            FileName = "spar_leder.json",
            FileSizeBytes = 21_500_000,
            FileHash = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"),
            StoredPath = $"/tmp/{Guid.NewGuid():N}.geojson",
            Status = status,
        };

        context.TrailImportSessions.Add(session);
        context.SaveChanges();

        return session.Id;
    }

    private static TrailImportProposal Add(
        StigViddDbContext context, int sessionId, string name, MatchConfidence confidence, int? suggestedTrailId,
        int? nearestTrailId = null)
    {
        var proposal = new TrailImportProposal
        {
            SessionId = sessionId,
            ExternalId = Guid.NewGuid().ToString("N")[..8],
            FeatureName = name,
            GeometryFingerprint = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"),
            FeatureGeometry = Line,
            SuggestedTrailId = suggestedTrailId,
            NearestTrailId = nearestTrailId ?? suggestedTrailId,
            Confidence = confidence,
            CoverageForward = 0.907,
            CoverageBackward = 0.992,
            Decision = ProposalDecision.Pending,
        };

        context.TrailImportProposals.Add(proposal);
        context.SaveChanges();

        return proposal;
    }

    [Fact]
    public async Task GetProposalsAsync_ShouldOrderTheOnesNeedingAHumanFirstAndNameTheSuggestedTrail()
    {
        // Arrange
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        Add(context, sessionId, "Exakt träff", MatchConfidence.Certain, TivedenId);
        Add(context, sessionId, "Ingen träff", MatchConfidence.Unmatched, null);
        Add(context, sessionId, "Behöver granskas", MatchConfidence.Medium, StorsjoledenId);

        // Act
        var result = await repository.GetProposalsAsync(sessionId, null, null, 1, 50, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.TotalCount.Should().Be(3);
        result.Value.HasMore.Should().BeFalse();

        result.Value.Items.Select(p => p.Confidence).Should()
            .ContainInOrder(MatchConfidence.Unmatched, MatchConfidence.Medium, MatchConfidence.Certain);

        result.Value.Items.Single(p => p.Confidence == MatchConfidence.Medium)
            .SuggestedTrailName.Should().Be("Storsjöleden");

        result.Value.Items.Single(p => p.Confidence == MatchConfidence.Unmatched)
            .SuggestedTrailName.Should().BeNull();
    }

    [Fact]
    public async Task GetProposalsAsync_ForAnUnmatchedFeature_ShouldNameTheNearestTrailWithoutSuggestingIt()
    {
        // Arrange — the 20 unmatched features read as "10/100 %" and nothing else. The
        // nearest trail is what those numbers were measured against.
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        Add(context, sessionId, "Etapp utan träff", MatchConfidence.Unmatched, null, nearestTrailId: TivedenId);

        // Act
        var result = await repository.GetProposalsAsync(sessionId, null, null, 1, 50, TestContext.Current.CancellationToken);

        // Assert
        var proposal = result.Value!.Items.Single();

        proposal.NearestTrailName.Should().Be("Tiveden");
        proposal.NearestTrailId.Should().Be(TivedenId);

        // Still not a suggestion: Accept has to keep refusing this one.
        proposal.SuggestedTrailId.Should().BeNull();
        proposal.SuggestedTrailName.Should().BeNull();
    }

    [Fact]
    public async Task GetProposalsAsync_WithinOneTier_ShouldListTheFeaturesByName()
    {
        // Arrange — added out of order, so insertion order cannot be what sorts them.
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        Add(context, sessionId, "Vänga mosse", MatchConfidence.Certain, TivedenId);
        Add(context, sessionId, "Brämhult", MatchConfidence.Certain, TivedenId);
        Add(context, sessionId, "Kröcklings hage", MatchConfidence.Certain, TivedenId);

        // Act
        var result = await repository.GetProposalsAsync(
            sessionId, MatchConfidence.Certain, null, 1, 50, TestContext.Current.CancellationToken);

        // Assert
        result.Value!.Items.Select(p => p.FeatureName).Should()
            .ContainInOrder("Brämhult", "Kröcklings hage", "Vänga mosse");
    }

    [Fact]
    public async Task GetProposalsAsync_WithAConfidenceFilter_ShouldReturnOnlyThatTier()
    {
        // Arrange
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        Add(context, sessionId, "Exakt", MatchConfidence.Certain, TivedenId);
        Add(context, sessionId, "Osäker", MatchConfidence.Medium, TivedenId);

        // Act
        var result = await repository.GetProposalsAsync(
            sessionId, MatchConfidence.Medium, null, 1, 50, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Items.Should().ContainSingle().Which.FeatureName.Should().Be("Osäker");
    }

    [Fact]
    public async Task GetProposalsAsync_WhenThereIsAnotherPage_ShouldSaySo()
    {
        // Arrange
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        for (var i = 0; i < 3; i++)
            Add(context, sessionId, $"Feature {i}", MatchConfidence.Certain, TivedenId);

        // Act
        var first = await repository.GetProposalsAsync(sessionId, null, null, 1, 2, TestContext.Current.CancellationToken);
        var second = await repository.GetProposalsAsync(sessionId, null, null, 2, 2, TestContext.Current.CancellationToken);

        // Assert
        first.Value!.Items.Should().HaveCount(2);
        first.Value.HasMore.Should().BeTrue();
        second.Value!.Items.Should().HaveCount(1);
        second.Value.HasMore.Should().BeFalse();
    }

    [Fact]
    public async Task GetProposalCountsAsync_ShouldCountByConfidenceAndByDecision()
    {
        // Arrange
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        Add(context, sessionId, "A", MatchConfidence.Certain, TivedenId);
        Add(context, sessionId, "B", MatchConfidence.Certain, TivedenId);
        Add(context, sessionId, "C", MatchConfidence.Unmatched, null);

        // Act
        var result = await repository.GetProposalCountsAsync(sessionId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Total.Should().Be(3);
        result.Value.Certain.Should().Be(2);
        result.Value.Unmatched.Should().Be(1);
        result.Value.Medium.Should().Be(0);
        result.Value.Pending.Should().Be(3);
        result.Value.Accepted.Should().Be(0);
    }

    [Fact]
    public async Task SetDecisionAsync_ForAccept_ShouldTakeTheTrailFromEachProposalsOwnSuggestion()
    {
        // Arrange — two proposals suggesting different trails, decided in one call.
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        var first = Add(context, sessionId, "A", MatchConfidence.Certain, TivedenId);
        var second = Add(context, sessionId, "B", MatchConfidence.Certain, StorsjoledenId);

        // Act
        var result = await repository.SetDecisionAsync(
            sessionId, [first.Id, second.Id], ProposalDecision.Accept,
            decidedTrailId: null, TrailSourceLinkRole.Segment, note: null, overrides: null, "granskare",
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(2);

        var rows = await context.TrailImportProposals
            .AsNoTracking()
            .Where(p => p.SessionId == sessionId)
            .ToDictionaryAsync(p => p.Id, TestContext.Current.CancellationToken);

        rows[first.Id].DecidedTrailId.Should().Be(TivedenId);
        rows[second.Id].DecidedTrailId.Should().Be(StorsjoledenId);
        rows[first.Id].Decision.Should().Be(ProposalDecision.Accept);
        rows[first.Id].DecidedBy.Should().Be("granskare");
        rows[first.Id].DecidedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task SetDecisionAsync_ForRelink_ShouldUseTheTrailTheReviewerPicked()
    {
        // Arrange
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        var proposal = Add(context, sessionId, "Sjuhäradsrundan", MatchConfidence.Medium, TivedenId);

        // Act
        var result = await repository.SetDecisionAsync(
            sessionId, [proposal.Id], ProposalDecision.Relink,
            StorsjoledenId, TrailSourceLinkRole.Segment, "kopplas om", overrides: null, "granskare",
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var row = await context.TrailImportProposals
            .AsNoTracking()
            .SingleAsync(p => p.Id == proposal.Id, TestContext.Current.CancellationToken);

        row.DecidedTrailId.Should().Be(StorsjoledenId);
        row.SuggestedTrailId.Should().Be(TivedenId);
        row.Note.Should().Be("kopplas om");
    }

    [Fact]
    public async Task SetDecisionAsync_ForCreateNew_ShouldKeepTheNameAndLengthTheReviewerPicked()
    {
        // Arrange — a new trail has nothing curated to protect, so the reviewer names it
        // here rather than editing it back to a short name after the import.
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        var proposal = Add(context, sessionId, "Bredareds IF vit vandringsled 13 km", MatchConfidence.Unmatched, null);

        // Act
        var result = await repository.SetDecisionAsync(
            sessionId, [proposal.Id], ProposalDecision.CreateNew,
            decidedTrailId: null, TrailSourceLinkRole.Segment, note: null,
            new ProposalOverrides("Bredareds IF Vit", 12.74m), "granskare",
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var row = await context.TrailImportProposals
            .AsNoTracking()
            .SingleAsync(p => p.Id == proposal.Id, TestContext.Current.CancellationToken);

        row.DecidedName.Should().Be("Bredareds IF Vit");
        row.DecidedLengthKm.Should().Be(12.74m);
        row.FeatureName.Should().Be("Bredareds IF vit vandringsled 13 km");
    }

    [Fact]
    public async Task SetDecisionAsync_ForPending_ShouldTakeTheOverridesOffAgain()
    {
        // Arrange — a name and a length the reviewer picked for a trail no longer created.
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        var proposal = Add(context, sessionId, "Bredareds IF vit vandringsled 13 km", MatchConfidence.Unmatched, null);

        await repository.SetDecisionAsync(
            sessionId, [proposal.Id], ProposalDecision.CreateNew,
            null, TrailSourceLinkRole.Segment, null,
            new ProposalOverrides("Bredareds IF Vit", 12.74m), "granskare",
            TestContext.Current.CancellationToken);

        // Act
        await repository.SetDecisionAsync(
            sessionId, [proposal.Id], ProposalDecision.Pending,
            null, TrailSourceLinkRole.Segment, null, overrides: null, "granskare",
            TestContext.Current.CancellationToken);

        // Assert
        var row = await context.TrailImportProposals
            .AsNoTracking()
            .SingleAsync(p => p.Id == proposal.Id, TestContext.Current.CancellationToken);

        row.DecidedName.Should().BeNull();
        row.DecidedLengthKm.Should().BeNull();
    }

    [Fact]
    public async Task SetDecisionAsync_ForPending_ShouldTakeTheReviewersStampOffAgain()
    {
        // Arrange — a proposal that was relinked, noted and signed for.
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        var proposal = Add(context, sessionId, "Banvallen", MatchConfidence.High, TivedenId);

        await repository.SetDecisionAsync(
            sessionId, [proposal.Id], ProposalDecision.Relink,
            StorsjoledenId, TrailSourceLinkRole.Duplicate, "fel led", overrides: null, "granskare",
            TestContext.Current.CancellationToken);

        // Act
        var result = await repository.SetDecisionAsync(
            sessionId, [proposal.Id], ProposalDecision.Pending,
            decidedTrailId: null, TrailSourceLinkRole.Segment, note: null, overrides: null, "granskare",
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var row = await context.TrailImportProposals
            .AsNoTracking()
            .SingleAsync(p => p.Id == proposal.Id, TestContext.Current.CancellationToken);

        row.Decision.Should().Be(ProposalDecision.Pending);
        row.DecidedBy.Should().BeNull();
        row.DecidedAt.Should().BeNull();
        row.DecidedTrailId.Should().BeNull();
        row.DecidedRole.Should().Be(TrailSourceLinkRole.Segment);
        row.Note.Should().BeNull();
    }

    [Fact]
    public async Task SetDecisionAsync_ForPending_ShouldLeaveWhatTheAnalysisFoundAlone()
    {
        // Arrange — undoing is not the same as forgetting what the geometry measured.
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        var proposal = Add(context, sessionId, "Banvallen", MatchConfidence.High, TivedenId);

        await repository.SetDecisionAsync(
            sessionId, [proposal.Id], ProposalDecision.Accept,
            null, TrailSourceLinkRole.Segment, null, overrides: null, "granskare",
            TestContext.Current.CancellationToken);

        // Act
        await repository.SetDecisionAsync(
            sessionId, [proposal.Id], ProposalDecision.Pending,
            null, TrailSourceLinkRole.Segment, null, overrides: null, "granskare",
            TestContext.Current.CancellationToken);

        // Assert
        var row = await context.TrailImportProposals
            .AsNoTracking()
            .SingleAsync(p => p.Id == proposal.Id, TestContext.Current.CancellationToken);

        row.SuggestedTrailId.Should().Be(TivedenId);
        row.Confidence.Should().Be(MatchConfidence.High);
    }

    [Fact]
    public async Task SetDecisionAsync_ShouldNotTouchProposalsInAnotherSession()
    {
        // Arrange
        var (repository, context) = Resolve();
        var mine = CreateSession(context);
        var other = CreateSession(context);

        var elsewhere = Add(context, other, "Annan session", MatchConfidence.Certain, TivedenId);

        // Act — the id is real, but it belongs to a session this call is not about.
        var result = await repository.SetDecisionAsync(
            mine, [elsewhere.Id], ProposalDecision.Accept,
            null, TrailSourceLinkRole.Segment, null, overrides: null, "granskare",
            TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().Be(0);

        var row = await context.TrailImportProposals
            .AsNoTracking()
            .SingleAsync(p => p.Id == elsewhere.Id, TestContext.Current.CancellationToken);

        row.Decision.Should().Be(ProposalDecision.Pending);
    }

    [Fact]
    public async Task CheckProposalsAsync_ShouldReportIdsFromElsewhereAndOnesWithNoSuggestion()
    {
        // Arrange
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);
        var other = CreateSession(context);

        var matched = Add(context, sessionId, "Matchad", MatchConfidence.Certain, TivedenId);
        var unmatched = Add(context, sessionId, "Omatchad", MatchConfidence.Unmatched, null);
        var elsewhere = Add(context, other, "Annan", MatchConfidence.Certain, TivedenId);

        // Act
        var result = await repository.CheckProposalsAsync(
            sessionId, [matched.Id, unmatched.Id, elsewhere.Id], TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Found.Should().Be(2);
        result.Value.WithoutSuggestion.Should().Be(1);
    }

    [Fact]
    public async Task DeleteSessionAsync_ShouldTakeTheProposalsWithItAndLeaveTheTrailsAlone()
    {
        // Arrange
        var (repository, context) = Resolve();
        var sessionId = CreateSession(context);

        Add(context, sessionId, "A", MatchConfidence.Certain, TivedenId);
        Add(context, sessionId, "B", MatchConfidence.Medium, StorsjoledenId);

        var trailsBefore = await context.Trails.CountAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await repository.DeleteSessionAsync(sessionId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        (await context.TrailImportProposals.CountAsync(p => p.SessionId == sessionId, TestContext.Current.CancellationToken))
            .Should().Be(0);
        (await context.Trails.CountAsync(TestContext.Current.CancellationToken)).Should().Be(trailsBefore);
    }

    [Fact]
    public async Task DeleteSessionAsync_ForASessionThatIsNotThere_ShouldReportNotFound()
    {
        // Arrange
        var (repository, _) = Resolve();

        // Act
        var result = await repository.DeleteSessionAsync(987654, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(Core.Common.RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetSessionsByFileHashAsync_ShouldFindAnEarlierUploadOfTheSameFile()
    {
        // Arrange
        var (repository, context) = Resolve();

        var hash = new string('c', 64);
        var session = new TrailImportSession
        {
            Source = "boras-stad",
            FileName = "spar_leder.json",
            FileHash = hash,
            StoredPath = "/tmp/first.geojson",
            Status = ImportSessionStatus.Applied,
        };

        context.TrailImportSessions.Add(session);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var same = await repository.GetSessionsByFileHashAsync("boras-stad", hash, TestContext.Current.CancellationToken);
        var otherSource = await repository.GetSessionsByFileHashAsync("annan-kalla", hash, TestContext.Current.CancellationToken);

        // Assert
        same.Value.Should().ContainSingle().Which.Id.Should().Be(session.Id);
        otherSource.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetTrailForReviewAsync_ShouldCarryTheCuratedLengthAndTheGeometry()
    {
        // Arrange
        var (repository, _) = Resolve();

        // Act
        var result = await repository.GetTrailForReviewAsync(TivedenId, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("Tiveden");
        result.Value.GeoPath.Should().NotBeNull();
        result.Value.TrailLength.Should().BeGreaterThan(0);
    }
}
