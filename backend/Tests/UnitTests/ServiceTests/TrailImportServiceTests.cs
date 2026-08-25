using Core.TrailImport.Apply;
using Core.TrailImport.Review;
using Core.TrailImport.Source;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NetTopologySuite.Geometries;
using System.Net;
using System.Text;

namespace UnitTests.ServiceTests;

/// <summary>
/// The guards that stop a session reaching the apply phase in a state it cannot be applied
/// from: a decision on a session nobody is reviewing, an accept on a match that was never
/// made, a relink to a trail that does not exist.
/// </summary>
public class TrailImportServiceTests
{
    private const int SessionId = 7;
    private const string Reviewer = "granskare";

    private readonly Mock<ITrailImportRepository> _repository = new();
    private readonly Mock<ITrailImportFileStore> _fileStore = new();
    private readonly Mock<ITrailImportAnalysisQueue> _queue = new();

    private TrailImportService CreateService() =>
        new(_repository.Object, _fileStore.Object, _queue.Object, new TrailImportResponseFactory(),
            NullLogger<TrailImportService>.Instance);

    private static TrailImportSession Session(ImportSessionStatus status, string? storedPath = null) => new()
    {
        Id = SessionId,
        Source = "boras-stad",
        FileName = "spar_leder.json",
        FileHash = new string('a', 64),
        StoredPath = storedPath ?? "/tmp/does-not-exist.geojson",
        Status = status,
    };

    private void SessionIs(ImportSessionStatus status, string? storedPath = null) =>
        _repository.Setup(r => r.GetSessionAsync(SessionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailImportSession>.Success(Session(status, storedPath)));

    private void DecisionsAtRisk(int count) =>
        _repository.Setup(r => r.GetDiscardableDecisionCountAsync(SessionId, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(count));

    private void ProposalsCheckOutAs(int found, int withoutSuggestion) =>
        _repository.Setup(r => r.CheckProposalsAsync(SessionId, It.IsAny<IReadOnlyCollection<int>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ProposalIdCheck>.Success(new ProposalIdCheck(found, withoutSuggestion)));

    private static Stream Content(string text = "{\"type\":\"FeatureCollection\"}") =>
        new MemoryStream(Encoding.UTF8.GetBytes(text));

    [Fact]
    public async Task CreateSessionAsync_ForAFileThatIsNotGeoJson_ShouldRejectItBeforeWritingAnything()
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.CreateSessionAsync(Content(), "leder.zip", null, Reviewer, CancellationToken.None);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
        _fileStore.Verify(f => f.SaveAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateSessionAsync_WhenTheSessionRowCannotBeWritten_ShouldDeleteTheStoredFile()
    {
        // Arrange — the file is only findable through the row, so an orphan is not left behind.
        _fileStore.Setup(f => f.SaveAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StoredImportFile("/tmp/stored.geojson", new string('b', 64), 21_500_000));

        _repository.Setup(r => r.GetSessionsByFileHashAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailImportSession>>.Success([]));

        _repository.Setup(r => r.AddSessionAsync(It.IsAny<TrailImportSession>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailImportSession>.Error());

        var service = CreateService();

        // Act
        var result = await service.CreateSessionAsync(Content(), "spar_leder.json", null, Reviewer, CancellationToken.None);

        // Assert
        result.IsFailure.Should().BeTrue();
        _fileStore.Verify(f => f.Delete("/tmp/stored.geojson"), Times.Once);
    }

    [Fact]
    public async Task CreateSessionAsync_WhenTheSameFileHasBeenUploadedBefore_ShouldSaySoWithoutRefusing()
    {
        // Arrange
        _fileStore.Setup(f => f.SaveAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StoredImportFile("/tmp/stored.geojson", new string('b', 64), 21_500_000));

        _repository.Setup(r => r.GetSessionsByFileHashAsync("boras-stad", It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailImportSession>>.Success(
                [Session(ImportSessionStatus.Applied)]));

        _repository.Setup(r => r.AddSessionAsync(It.IsAny<TrailImportSession>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((TrailImportSession s, CancellationToken _) => RepositoryResult<TrailImportSession>.Success(s));

        var service = CreateService();

        // Act
        var result = await service.CreateSessionAsync(Content(), "spar_leder.json", null, Reviewer, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.DuplicateOf.Should().HaveCount(1);
        result.Value.Status.Should().Be(nameof(ImportSessionStatus.Uploaded));
    }

    [Fact]
    public async Task QueueAnalysisAsync_WhenAnalysisIsAlreadyRunning_ShouldNotQueueItTwice()
    {
        // Arrange
        SessionIs(ImportSessionStatus.Analyzing);
        var service = CreateService();

        // Act
        var result = await service.QueueAnalysisAsync(SessionId, force: false, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.Conflict);
        _queue.Verify(q => q.Enqueue(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task QueueAnalysisAsync_ForAnAppliedSession_ShouldRefuse()
    {
        // Arrange — re-analysing what has already been written to Trails would propose it again.
        SessionIs(ImportSessionStatus.Applied);
        var service = CreateService();

        // Act
        var result = await service.QueueAnalysisAsync(SessionId, force: false, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.Conflict);
        _queue.Verify(q => q.Enqueue(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task QueueAnalysisAsync_WhenTheUploadedFileIsGone_ShouldSaySoRatherThanQueueAFailure()
    {
        // Arrange — a volume that was not carried across, for instance.
        SessionIs(ImportSessionStatus.Uploaded);
        var service = CreateService();

        // Act
        var result = await service.QueueAnalysisAsync(SessionId, force: false, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.Conflict);
        result.Message.ResultMessage.Should().Contain("no longer on disk");
        _queue.Verify(q => q.Enqueue(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task QueueAnalysisAsync_ForAnUploadedSession_ShouldMarkItAnalyzingBeforeQueueing()
    {
        // Arrange — the status is what stops a second request queueing the same session.
        var file = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.geojson");
        await File.WriteAllTextAsync(file, "{}", TestContext.Current.CancellationToken);

        try
        {
            SessionIs(ImportSessionStatus.Uploaded, file);
            DecisionsAtRisk(0);

            TrailImportSession? saved = null;
            _repository.Setup(r => r.UpdateSessionAsync(It.IsAny<TrailImportSession>(), It.IsAny<CancellationToken>()))
                .Callback((TrailImportSession s, CancellationToken _) => saved = s)
                .ReturnsAsync(RepositoryResult.Success());

            var service = CreateService();

            // Act
            var result = await service.QueueAnalysisAsync(SessionId, force: false, CancellationToken.None);

            // Assert
            result.Success.Should().BeTrue();
            saved!.Status.Should().Be(ImportSessionStatus.Analyzing);
            _queue.Verify(q => q.Enqueue(SessionId), Times.Once);
        }
        finally
        {
            File.Delete(file);
        }
    }

    [Fact]
    public async Task DecideAsync_ForASessionThatIsNotAwaitingReview_ShouldRefuse()
    {
        // Arrange
        SessionIs(ImportSessionStatus.Uploaded);
        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1], nameof(ProposalDecision.Accept), null, null, null, overrides: null, Reviewer, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.Conflict);
        _repository.Verify(r => r.SetDecisionAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<int>>(),
            It.IsAny<ProposalDecision>(), It.IsAny<int?>(), It.IsAny<TrailSourceLinkRole>(),
            It.IsAny<string>(), It.IsAny<ProposalOverrides?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DecideAsync_ForANameOnAnythingButCreateNew_ShouldRefuse()
    {
        // Arrange — the short names in the database are a decision, and a decision that
        // reaches an existing trail through the review view is the same overwrite by hand.
        SessionIs(ImportSessionStatus.AwaitingReview);
        ProposalsCheckOutAs(found: 1, withoutSuggestion: 0);
        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1], nameof(ProposalDecision.Accept), null, null, null,
            new ProposalOverrides("Bredareds IF Vit", null), Reviewer, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
        _repository.Verify(r => r.SetDecisionAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<int>>(),
            It.IsAny<ProposalDecision>(), It.IsAny<int?>(), It.IsAny<TrailSourceLinkRole>(),
            It.IsAny<string>(), It.IsAny<ProposalOverrides?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DecideAsync_ForALengthOnADecisionThatLinksToNothing_ShouldRefuse()
    {
        // Arrange
        SessionIs(ImportSessionStatus.AwaitingReview);
        ProposalsCheckOutAs(found: 1, withoutSuggestion: 0);
        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1], nameof(ProposalDecision.Skip), null, null, null,
            new ProposalOverrides(null, 12.74m), Reviewer, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DecideAsync_ForALengthOfNothing_ShouldRefuse()
    {
        // Arrange — a trail of zero kilometres reads as a length that was measured.
        SessionIs(ImportSessionStatus.AwaitingReview);
        ProposalsCheckOutAs(found: 1, withoutSuggestion: 0);
        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1], nameof(ProposalDecision.CreateNew), null, null, null,
            new ProposalOverrides(null, 0m), Reviewer, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DecideAsync_ForACreateNewWithANameAndALength_ShouldPassThemOnTrimmed()
    {
        // Arrange
        SessionIs(ImportSessionStatus.AwaitingReview);
        ProposalsCheckOutAs(found: 1, withoutSuggestion: 1);

        ProposalOverrides? stored = null;
        _repository.Setup(r => r.SetDecisionAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<int>>(),
                It.IsAny<ProposalDecision>(), It.IsAny<int?>(), It.IsAny<TrailSourceLinkRole>(),
                It.IsAny<string>(), It.IsAny<ProposalOverrides?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback((int _, IReadOnlyCollection<int> _, ProposalDecision _, int? _,
                       TrailSourceLinkRole _, string? _, ProposalOverrides? overrides, string _,
                       CancellationToken _) => stored = overrides)
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1], nameof(ProposalDecision.CreateNew), null, null, null,
            new ProposalOverrides("  Bredareds IF Vit  ", 12.74m), Reviewer, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        stored!.Name.Should().Be("Bredareds IF Vit");
        stored.LengthKm.Should().Be(12.74m);
    }

    [Fact]
    public async Task DecideAsync_ForADecisionThatDoesNotExist_ShouldListTheOnesThatDo()
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1], "Godkänn", null, null, null, overrides: null, Reviewer, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
        result.Message.ResultMessage.Should().Contain(nameof(ProposalDecision.Relink));
    }

    [Fact]
    public async Task DecideAsync_ForRelinkWithoutATrail_ShouldRefuse()
    {
        // Arrange
        SessionIs(ImportSessionStatus.AwaitingReview);
        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1], nameof(ProposalDecision.Relink), null, null, null, overrides: null, Reviewer, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DecideAsync_ForRelinkToATrailThatIsNotThere_ShouldRefuse()
    {
        // Arrange
        SessionIs(ImportSessionStatus.AwaitingReview);
        _repository.Setup(r => r.GetTrailIdByIdentifierAsync("okand-led", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1], nameof(ProposalDecision.Relink), "okand-led", null, null, overrides: null, Reviewer, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
        result.Message.ResultMessage.Should().Contain("okand-led");
    }

    [Fact]
    public async Task DecideAsync_WhenAnIdBelongsToAnotherSession_ShouldRefuseTheWholeBatch()
    {
        // Arrange — three asked for, two found.
        SessionIs(ImportSessionStatus.AwaitingReview);
        ProposalsCheckOutAs(found: 2, withoutSuggestion: 0);

        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1, 2, 3], nameof(ProposalDecision.Skip), null, null, null, overrides: null, Reviewer, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
        _repository.Verify(r => r.SetDecisionAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<int>>(),
            It.IsAny<ProposalDecision>(), It.IsAny<int?>(), It.IsAny<TrailSourceLinkRole>(),
            It.IsAny<string>(), It.IsAny<ProposalOverrides?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DecideAsync_ForAcceptOnAFeatureThatMatchedNothing_ShouldRefuse()
    {
        // Arrange — accepting it would approve the proposal and leave it pointing nowhere.
        SessionIs(ImportSessionStatus.AwaitingReview);
        ProposalsCheckOutAs(found: 2, withoutSuggestion: 1);

        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1, 2], nameof(ProposalDecision.Accept), null, null, null, overrides: null, Reviewer, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
        result.Message.ResultMessage.Should().Contain("no suggested trail");
    }

    [Fact]
    public async Task DecideAsync_ForAcceptOnMatchedFeatures_ShouldSaveTheDecision()
    {
        // Arrange
        SessionIs(ImportSessionStatus.AwaitingReview);
        ProposalsCheckOutAs(found: 2, withoutSuggestion: 0);

        _repository.Setup(r => r.SetDecisionAsync(SessionId, It.IsAny<IReadOnlyCollection<int>>(),
                ProposalDecision.Accept, null, TrailSourceLinkRole.Segment, null, It.IsAny<ProposalOverrides?>(), Reviewer, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1, 2], "accept", null, null, null, overrides: null, Reviewer, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().Be(2);
    }

    [Fact]
    public async Task DecideAsync_ForAcceptAsDuplicate_ShouldStoreTheRoleTheReviewerPicked()
    {
        // Arrange — an aggregate feature linked as Segment would merge its whole line into
        // the trail's GeoPath, so the role the reviewer picked has to reach the repository.
        SessionIs(ImportSessionStatus.AwaitingReview);
        ProposalsCheckOutAs(found: 1, withoutSuggestion: 0);

        _repository.Setup(r => r.SetDecisionAsync(SessionId, It.IsAny<IReadOnlyCollection<int>>(),
                ProposalDecision.Accept, null, TrailSourceLinkRole.Duplicate, null, It.IsAny<ProposalOverrides?>(), Reviewer, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1], nameof(ProposalDecision.Accept), null,
            nameof(TrailSourceLinkRole.Duplicate), null, overrides: null, Reviewer, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().Be(1);
    }

    [Fact]
    public async Task DecideAsync_ForARoleThatDoesNotExist_ShouldListTheOnesThatDo()
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1], nameof(ProposalDecision.Accept), null, "Aggregate", null, overrides: null, Reviewer, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
        result.Message.ResultMessage.Should().Contain(nameof(TrailSourceLinkRole.Segment))
            .And.Contain(nameof(TrailSourceLinkRole.Duplicate));
    }

    [Fact]
    public async Task DecideAsync_ForExclude_ShouldStoreTheExcludedRoleWhateverWasAskedFor()
    {
        // Arrange
        SessionIs(ImportSessionStatus.AwaitingReview);
        ProposalsCheckOutAs(found: 1, withoutSuggestion: 0);

        TrailSourceLinkRole? stored = null;
        _repository.Setup(r => r.SetDecisionAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<int>>(),
                It.IsAny<ProposalDecision>(), It.IsAny<int?>(), It.IsAny<TrailSourceLinkRole>(),
                It.IsAny<string>(), It.IsAny<ProposalOverrides?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback((int _, IReadOnlyCollection<int> _, ProposalDecision _, int? _,
                       TrailSourceLinkRole role, string? _, ProposalOverrides? _, string _, CancellationToken _) => stored = role)
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [1], nameof(ProposalDecision.Exclude), null,
            nameof(TrailSourceLinkRole.Segment), "avpublicerad i källan", overrides: null, Reviewer, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        stored.Should().Be(TrailSourceLinkRole.Excluded);
    }

    [Fact]
    public async Task DecideAsync_WithNoProposals_ShouldRefuse()
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.DecideAsync(
            SessionId, [], nameof(ProposalDecision.Skip), null, null, null, overrides: null, Reviewer, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetProposalsAsync_ForAConfidenceThatDoesNotExist_ShouldRefuseBeforeReadingTheSession()
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.GetProposalsAsync(SessionId, "Kanske", null, 1, 50, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.BadRequest);
        _repository.Verify(r => r.GetSessionAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeleteSessionAsync_WhileTheAnalysisIsRunning_ShouldRefuse()
    {
        // Arrange — the worker would go on writing proposals to a row that no longer exists.
        SessionIs(ImportSessionStatus.Analyzing);
        var service = CreateService();

        // Act
        var result = await service.DeleteSessionAsync(SessionId, CancellationToken.None);

        // Assert
        result.Message!.StatusCode.Should().Be((int)HttpStatusCode.Conflict);
        _repository.Verify(r => r.DeleteSessionAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        _fileStore.Verify(f => f.Delete(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task DeleteSessionAsync_ForASessionAwaitingReview_ShouldTakeTheUploadedFileWithIt()
    {
        // Arrange
        SessionIs(ImportSessionStatus.AwaitingReview, "/tmp/stored.geojson");
        _repository.Setup(r => r.DeleteSessionAsync(SessionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var service = CreateService();

        // Act
        var result = await service.DeleteSessionAsync(SessionId, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        _fileStore.Verify(f => f.Delete("/tmp/stored.geojson"), Times.Once);
    }

    private static ApplyPlanRow Row(
        int id, ProposalDecision decision, int? targetTrailId = null, string? trailName = null,
        MatchConfidence confidence = MatchConfidence.Unmatched,
        TrailSourceLinkRole role = TrailSourceLinkRole.Segment, double coverage = 0) =>
        new(id, $"feature {id}", id.ToString(), new string('f', 64), decision, role, confidence,
            coverage, targetTrailId, trailName, null, null);

    private void PlanIs(params ApplyPlanRow[] rows) => PlanIs(rows, [], []);

    private static LineString Line() => GeoPointFactory.FromLonLatPath(
        [new Coordinate(12.9, 57.7), new Coordinate(12.91, 57.71)]);

    private void PlanIs(ApplyPlanRow[] rows, int[] withExistingSegment, int[] withBaseline)
    {
        _repository.Setup(r => r.GetApplyPlanAsync(SessionId, "boras-stad", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ApplyPlan>.Success(new ApplyPlan(
                rows, withExistingSegment.ToHashSet(), withBaseline.ToHashSet())));

        // The diff runs the real planner over the same rows, so what the preview reports is
        // what an apply would write rather than what the decisions look like.
        ApplyInputIs(rows, withBaseline, []);
    }

    private void ApplyInputIs(
        ApplyPlanRow[] rows, int[] withBaseline, (string Fingerprint, ApplyBaseline Link)[] links,
        string? properties = null)
    {
        var features = rows.Select(r => new ApplyFeature(
            r.ProposalId, r.ExternalId, r.FeatureName, r.GeometryFingerprint, properties, Line(),
            r.Decision, r.Role, r.Confidence, r.TargetTrailId, r.DecidedName, r.DecidedLengthKm))
            .ToList();

        // The target carries the same line as the features, so a preview only reports a
        // route change when the test means one.
        var targets = rows
            .Where(r => r.TargetTrailId is not null)
            .GroupBy(r => r.TargetTrailId!.Value)
            .ToDictionary(g => g.Key, g => new ApplyTarget(
                g.Key, g.First().TargetTrailName ?? string.Empty, 0, false, string.Empty,
                string.Empty, Line()));

        _repository.Setup(r => r.GetApplyInputAsync(SessionId, "boras-stad", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<ApplyInput>.Success(new ApplyInput(
                features,
                targets,
                links.ToDictionary(l => l.Fingerprint, l => l.Link, StringComparer.Ordinal),
                withBaseline.ToHashSet())));
    }

    [Fact]
    public async Task GetDiffAsync_ForTwoFeaturesOnOneTrail_ShouldCountThatTrailOnce()
    {
        // Arrange — the 1:N case: several source features make up one real trail
        SessionIs(ImportSessionStatus.AwaitingReview);
        PlanIs(
            Row(1, ProposalDecision.Accept, targetTrailId: 302, trailName: "Etapp 04"),
            Row(2, ProposalDecision.Accept, targetTrailId: 302, trailName: "Etapp 04"),
            Row(3, ProposalDecision.CreateNew),
            Row(4, ProposalDecision.Skip),
            Row(5, ProposalDecision.Pending));

        var service = CreateService();

        // Act
        var result = await service.GetDiffAsync(SessionId, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.TrailsLinked.Should().Be(1);
        // Linked is not updated: with no stored snapshot the merge may write no field.
        result.Value.TrailsToUpdate.Should().Be(0);
        result.Value.TrailsToCreate.Should().Be(1);
        result.Value.LinksToWrite.Should().Be(3);
        result.Value.FeaturesSkipped.Should().Be(1);
        result.Value.FeaturesPending.Should().Be(1);
        result.Value.CanApply.Should().BeTrue();
    }

    [Fact]
    public async Task GetDiffAsync_ForATrailTheSourceHasWrittenBefore_ShouldCountItAsUpdated()
    {
        // Arrange — the second sync: a snapshot exists, so a field the source changed and
        // nobody edited locally is one the merge may take
        SessionIs(ImportSessionStatus.AwaitingReview);
        var rows = new[] { Row(1, ProposalDecision.Accept, targetTrailId: 302, trailName: "Etapp 04") };
        PlanIs(rows, [], [302]);
        ApplyInputIs(
            rows,
            [302],
            [(rows[0].GeometryFingerprint, new ApplyBaseline(11, 302, "{}"))],
            properties: """{"klassning":"Svår"}""");

        var service = CreateService();

        // Act
        var result = await service.GetDiffAsync(SessionId, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.TrailsLinked.Should().Be(1);
        result.Value.TrailsToUpdate.Should().Be(1);
    }

    [Fact]
    public async Task GetDiffAsync_ForADecisionAgainstAStrongMatch_ShouldListIt()
    {
        // Arrange — the Banvallen case: a High overlap the reviewer deliberately overrode,
        // alongside an Accept that agrees with the analysis and must not be listed
        SessionIs(ImportSessionStatus.AwaitingReview);
        PlanIs(
            Row(1, ProposalDecision.CreateNew, confidence: MatchConfidence.High, coverage: 0.91),
            Row(2, ProposalDecision.Accept, targetTrailId: 276, trailName: "Banvallen",
                confidence: MatchConfidence.Certain, coverage: 1.0),
            Row(3, ProposalDecision.Exclude, confidence: MatchConfidence.Medium));

        var service = CreateService();

        // Act
        var result = await service.GetDiffAsync(SessionId, CancellationToken.None);

        // Assert — only the override on a strong match, not the agreement and not the Medium
        result.Value!.AgainstStrongMatch.Should().ContainSingle()
            .Which.ProposalId.Should().Be(1);
    }

    [Fact]
    public async Task GetDiffAsync_ForATrailLeftWithOnlyDuplicateLinks_ShouldListIt()
    {
        // Arrange — trail 400 gets nothing but Duplicate links, so no geometry to merge
        // from; trail 401 gets the same but already carries a Segment link from before
        SessionIs(ImportSessionStatus.AwaitingReview);
        PlanIs(
            [
                Row(1, ProposalDecision.Accept, targetTrailId: 400, trailName: "Vänga mosse",
                    role: TrailSourceLinkRole.Duplicate),
                Row(2, ProposalDecision.Accept, targetTrailId: 401, trailName: "Sjuhäradsrundan",
                    role: TrailSourceLinkRole.Duplicate),
            ],
            withExistingSegment: [401],
            withBaseline: [401]);

        var service = CreateService();

        // Act
        var result = await service.GetDiffAsync(SessionId, CancellationToken.None);

        // Assert
        result.Value!.WithoutSegment.Should().ContainSingle()
            .Which.TrailId.Should().Be(400);
    }

    [Fact]
    public async Task GetDiffAsync_WithNothingDecided_ShouldNotBeApplicable()
    {
        // Arrange
        SessionIs(ImportSessionStatus.AwaitingReview);
        PlanIs(Row(1, ProposalDecision.Pending), Row(2, ProposalDecision.Skip));

        var service = CreateService();

        // Act
        var result = await service.GetDiffAsync(SessionId, CancellationToken.None);

        // Assert
        result.Value!.CanApply.Should().BeFalse();
        result.Value.BlockedReason.Should().Contain("decided");
    }

    [Fact]
    public async Task GetDiffAsync_ForASessionAlreadyApplied_ShouldNotBeApplicableAgain()
    {
        // Arrange
        SessionIs(ImportSessionStatus.Applied);
        PlanIs(Row(1, ProposalDecision.Accept, targetTrailId: 302, trailName: "Etapp 04"));

        var service = CreateService();

        // Act
        var result = await service.GetDiffAsync(SessionId, CancellationToken.None);

        // Assert
        result.Value!.CanApply.Should().BeFalse();
        result.Value.BlockedReason.Should().Contain("already been applied");
    }
}
