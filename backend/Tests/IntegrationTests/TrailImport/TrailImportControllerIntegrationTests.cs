using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NetTopologySuite.Geometries;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using WebDataContracts.RequestModels.TrailImport;
using WebDataContracts.ResponseModels.TrailImport;

namespace IntegrationTests.TrailImport;

/// <summary>
/// The admin endpoints end to end: uploading an export, walking its proposals and
/// deciding them. Nothing here reaches Trails — that is the apply phase, which does not
/// exist yet.
/// </summary>
public class TrailImportControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string Base = "/api/v1/admin/trail-import";
    private const string AdminRole = "stigvidd-admin";
    private const string AuthenticatedUser = "firebase-uid-12345";
    private const int TivedenId = 1;
    private const int StorsjoledenId = 2;
    private const string StorsjoledenIdentifier = "22b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public TrailImportControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient AdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add("X-Test-Roles", AdminRole);

        return client;
    }

    private static MultipartFormDataContent Upload(string fileName, string json = "{\"type\":\"FeatureCollection\",\"features\":[]}")
    {
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes(json));
        file.Headers.ContentType = new MediaTypeHeaderValue("application/geo+json");

        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    private StigViddDbContext Context()
    {
        var scope = _factory.Services.CreateScope();

        return scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();
    }

    // unmatched seeds the proposal the way the analysis leaves a feature nothing matched:
    // no suggestion, but the trail the coverage was measured against.
    private static int SeedReviewableSession(StigViddDbContext context, out int proposalId, bool unmatched = false)
    {
        var session = new TrailImportSession
        {
            Source = "boras-stad",
            FileName = "spar_leder.json",
            FileHash = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"),
            StoredPath = $"/tmp/{Guid.NewGuid():N}.geojson",
            Status = ImportSessionStatus.AwaitingReview,
            FeatureCount = 1,
        };

        context.TrailImportSessions.Add(session);
        context.SaveChanges();

        var proposal = new TrailImportProposal
        {
            SessionId = session.Id,
            ExternalId = "148",
            FeatureName = "Sjuhäradsrundan",
            GeometryFingerprint = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"),
            // Roughly a kilometre of it, so the measured length is something to look at.
            FeatureGeometry = GeoPointFactory.FromLonLatPath(
            [
                new Coordinate(12.805, 57.621),
                new Coordinate(12.815, 57.626),
            ]),
            FeatureProperties = "{\"sparlangd\": \"130 km\"}",
            SuggestedTrailId = unmatched ? null : TivedenId,
            NearestTrailId = TivedenId,
            Confidence = unmatched ? MatchConfidence.Unmatched : MatchConfidence.Medium,
            CoverageForward = 0.907,
            CoverageBackward = 0.992,
            HausdorffMeters = 4801,
            MatchReason = "91% mutual coverage within 15 m",
            Decision = ProposalDecision.Pending,
        };

        context.TrailImportProposals.Add(proposal);
        context.SaveChanges();

        proposalId = proposal.Id;

        return session.Id;
    }

    [Fact]
    public async Task Endpoints_ForACallerWhoIsNotAnAdmin_ShouldBeForbidden()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);

        // Act
        var response = await client.GetAsync($"{Base}/sessions", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CreateSession_ForAGeoJsonUpload_ShouldOpenASessionAndDeleteItAgain()
    {
        // Arrange
        var client = AdminClient();

        // Act
        var created = await client.PostAsync($"{Base}/sessions", Upload("spar_leder.json"), TestContext.Current.CancellationToken);
        var session = await created.Content.ReadFromJsonAsync<TrailImportSessionResponse>(TestContext.Current.CancellationToken);

        // Assert
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        session!.Status.Should().Be(nameof(ImportSessionStatus.Uploaded));
        session.FileName.Should().Be("spar_leder.json");
        session.FileHash.Should().HaveLength(64);
        session.FileSizeBytes.Should().BeGreaterThan(0);
        session.DuplicateOf.Should().BeEmpty();

        var listed = await client.GetFromJsonAsync<IReadOnlyCollection<TrailImportSessionResponse>>(
            $"{Base}/sessions", TestContext.Current.CancellationToken);

        listed!.Select(s => s.Id).Should().Contain(session.Id);

        // The upload wrote a real file; deleting the session is what removes it.
        var deleted = await client.DeleteAsync($"{Base}/sessions/{session.Id}", TestContext.Current.CancellationToken);
        deleted.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task CreateSession_ForTheSameFileTwice_ShouldWarnRatherThanRefuse()
    {
        // Arrange
        var client = AdminClient();
        const string json = "{\"type\":\"FeatureCollection\",\"features\":[{\"id\":1}]}";

        var first = await client.PostAsync($"{Base}/sessions", Upload("spar_leder.json", json), TestContext.Current.CancellationToken);
        var firstSession = await first.Content.ReadFromJsonAsync<TrailImportSessionResponse>(TestContext.Current.CancellationToken);

        // Act
        var second = await client.PostAsync($"{Base}/sessions", Upload("spar_leder.json", json), TestContext.Current.CancellationToken);
        var secondSession = await second.Content.ReadFromJsonAsync<TrailImportSessionResponse>(TestContext.Current.CancellationToken);

        // Assert
        second.StatusCode.Should().Be(HttpStatusCode.Created);
        secondSession!.DuplicateOf.Should().Contain(firstSession!.Identifier);

        await client.DeleteAsync($"{Base}/sessions/{firstSession.Id}", TestContext.Current.CancellationToken);
        await client.DeleteAsync($"{Base}/sessions/{secondSession.Id}", TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task CreateSession_ForAFileThatIsNotGeoJson_ShouldBeRejected()
    {
        // Arrange
        var client = AdminClient();

        // Act
        var response = await client.PostAsync($"{Base}/sessions", Upload("spar_leder.zip"), TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Analyze_WhenItIsAlreadyQueued_ShouldNotQueueItASecondTime()
    {
        // Arrange — the worker is removed from the test host, so the session stays Analyzing.
        var client = AdminClient();

        var created = await client.PostAsync($"{Base}/sessions", Upload("spar_leder.json", "{\"features\":[]}"), TestContext.Current.CancellationToken);
        var session = await created.Content.ReadFromJsonAsync<TrailImportSessionResponse>(TestContext.Current.CancellationToken);

        // Act
        var first = await client.PostAsync($"{Base}/sessions/{session!.Id}/analyze", null, TestContext.Current.CancellationToken);
        var second = await client.PostAsync($"{Base}/sessions/{session.Id}/analyze", null, TestContext.Current.CancellationToken);

        // Assert
        first.StatusCode.Should().Be(HttpStatusCode.Accepted);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);

        // Deleting is refused while it is held, which is the same guard from the other side.
        var deleted = await client.DeleteAsync($"{Base}/sessions/{session.Id}", TestContext.Current.CancellationToken);
        deleted.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task GetSession_ShouldCarryTheCountsPerConfidenceAndDecision()
    {
        // Arrange
        using var context = Context();
        var sessionId = SeedReviewableSession(context, out _);

        // Act
        var session = await AdminClient().GetFromJsonAsync<TrailImportSessionResponse>(
            $"{Base}/sessions/{sessionId}", TestContext.Current.CancellationToken);

        // Assert
        session!.Counts.Should().NotBeNull();
        session.Counts!.Total.Should().Be(1);
        session.Counts.Medium.Should().Be(1);
        session.Counts.Pending.Should().Be(1);
    }

    [Fact]
    public async Task GetSession_ForOneThatIsNotThere_ShouldReturnNotFound()
    {
        // Act
        var response = await AdminClient().GetAsync($"{Base}/sessions/987654", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetProposals_ShouldNameTheSuggestedTrailAndReportTheConfidenceByName()
    {
        // Arrange
        using var context = Context();
        var sessionId = SeedReviewableSession(context, out _);

        // Act
        var response = await AdminClient().GetAsync(
            $"{Base}/sessions/{sessionId}/proposals", TestContext.Current.CancellationToken);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.Should().Contain("Sjuhäradsrundan").And.Contain("Tiveden").And.Contain(nameof(MatchConfidence.Medium));
    }

    [Fact]
    public async Task GetProposals_ForAConfidenceThatDoesNotExist_ShouldReturnBadRequest()
    {
        // Arrange
        using var context = Context();
        var sessionId = SeedReviewableSession(context, out _);

        // Act
        var response = await AdminClient().GetAsync(
            $"{Base}/sessions/{sessionId}/proposals?confidence=Kanske", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetPreview_ShouldReturnBothLinesAndBothLengths()
    {
        // Arrange
        using var context = Context();
        var sessionId = SeedReviewableSession(context, out var proposalId);

        // Act
        var preview = await AdminClient().GetFromJsonAsync<TrailImportPreviewResponse>(
            $"{Base}/sessions/{sessionId}/proposals/{proposalId}/preview", TestContext.Current.CancellationToken);

        // Assert
        preview!.FeatureCoordinates.Should().HaveCount(2);
        preview.FeatureCoordinates[0].Should().Equal(12.805, 57.621);
        preview.FeatureLengthKm.Should().BeGreaterThan(0);

        // The source says 130 km for a line that measures about one, which is exactly the
        // sort of stated length that must not be trusted.
        preview.SourceStatedLengthKm.Should().Be(130m);
        preview.SourceLengthDisagrees.Should().BeTrue();

        preview.TrailId.Should().Be(TivedenId);
        preview.TrailName.Should().Be("Tiveden");
        preview.TrailCoordinates.Should().NotBeEmpty();
        preview.TrailMeasuredLengthKm.Should().NotBeNull();
        preview.HausdorffMeters.Should().Be(4801);
        preview.TrailIsNearestOnly.Should().BeFalse();
    }

    [Fact]
    public async Task GetPreview_ForAFeatureThatMatchedNothing_ShouldDrawTheNearestTrailAndSaySoItIsNotASuggestion()
    {
        // Arrange
        using var context = Context();
        var sessionId = SeedReviewableSession(context, out var proposalId, unmatched: true);

        // Act
        var preview = await AdminClient().GetFromJsonAsync<TrailImportPreviewResponse>(
            $"{Base}/sessions/{sessionId}/proposals/{proposalId}/preview", TestContext.Current.CancellationToken);

        // Assert — the line is there to place the feature against, and the flag is what
        // stops the view reading it as a match the reviewer may accept.
        preview!.TrailId.Should().Be(TivedenId);
        preview.TrailCoordinates.Should().NotBeEmpty();
        preview.TrailIsNearestOnly.Should().BeTrue();
    }

    [Fact]
    public async Task Decide_ForAccept_ShouldRecordTheDecisionAndWhoMadeIt()
    {
        // Arrange
        using var context = Context();
        var sessionId = SeedReviewableSession(context, out var proposalId);

        var request = new DecideProposalRequest { Decision = nameof(ProposalDecision.Accept) };

        // Act
        var response = await AdminClient().PostAsJsonAsync(
            $"{Base}/sessions/{sessionId}/proposals/{proposalId}/decide", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var row = await context.TrailImportProposals
            .AsNoTracking()
            .SingleAsync(p => p.Id == proposalId, TestContext.Current.CancellationToken);

        row.Decision.Should().Be(ProposalDecision.Accept);
        row.DecidedTrailId.Should().Be(TivedenId);
        row.DecidedBy.Should().Be("Test User");
    }

    [Fact]
    public async Task Decide_ForRelinkToATrailThatIsNotThere_ShouldReturnBadRequest()
    {
        // Arrange
        using var context = Context();
        var sessionId = SeedReviewableSession(context, out var proposalId);

        var request = new DecideProposalRequest { Decision = nameof(ProposalDecision.Relink), TrailIdentifier = "ingen-sadan-led" };

        // Act
        var response = await AdminClient().PostAsJsonAsync(
            $"{Base}/sessions/{sessionId}/proposals/{proposalId}/decide", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Decide_ForRelink_ShouldResolveTheIdentifierToTheTrailBehindIt()
    {
        // Arrange — the reviewer picked a different trail than the one suggested, which is
        // what 242 Sjuhäradsrundan is going to need.
        using var context = Context();
        var sessionId = SeedReviewableSession(context, out var proposalId);

        var request = new DecideProposalRequest
        {
            Decision = nameof(ProposalDecision.Relink),
            TrailIdentifier = StorsjoledenIdentifier,
            Note = "kopplas om",
        };

        // Act
        var response = await AdminClient().PostAsJsonAsync(
            $"{Base}/sessions/{sessionId}/proposals/{proposalId}/decide", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var row = await context.TrailImportProposals
            .AsNoTracking()
            .SingleAsync(p => p.Id == proposalId, TestContext.Current.CancellationToken);

        row.DecidedTrailId.Should().Be(StorsjoledenId);
        row.SuggestedTrailId.Should().Be(TivedenId);
        row.Note.Should().Be("kopplas om");
    }

    [Fact]
    public async Task DecideBulk_ShouldReportHowManyItDecided()
    {
        // Arrange
        using var context = Context();
        var sessionId = SeedReviewableSession(context, out var proposalId);

        var request = new DecideProposalsBulkRequest
        {
            ProposalIds = [proposalId],
            Decision = nameof(ProposalDecision.Skip),
            Note = "väntar på nästa export",
        };

        // Act
        var response = await AdminClient().PostAsJsonAsync(
            $"{Base}/sessions/{sessionId}/decide-bulk", request, TestContext.Current.CancellationToken);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.Should().Contain("\"decided\":1");
    }

    [Fact]
    public async Task DecideBulk_WithAnIdFromAnotherSession_ShouldRefuseTheWholeBatch()
    {
        // Arrange
        using var context = Context();
        var sessionId = SeedReviewableSession(context, out var proposalId);
        SeedReviewableSession(context, out var elsewhere);

        var request = new DecideProposalsBulkRequest
        {
            ProposalIds = [proposalId, elsewhere],
            Decision = nameof(ProposalDecision.Skip),
        };

        // Act
        var response = await AdminClient().PostAsJsonAsync(
            $"{Base}/sessions/{sessionId}/decide-bulk", request, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var untouched = await context.TrailImportProposals
            .AsNoTracking()
            .SingleAsync(p => p.Id == proposalId, TestContext.Current.CancellationToken);

        untouched.Decision.Should().Be(ProposalDecision.Pending);
    }

    [Fact]
    public async Task GetVocabulary_ShouldListTheNamesTheOtherEndpointsAccept()
    {
        // Act
        var response = await AdminClient().GetAsync($"{Base}/vocabulary", TestContext.Current.CancellationToken);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.Should().Contain(nameof(MatchConfidence.Certain))
            .And.Contain(nameof(ProposalDecision.Relink))
            .And.Contain(nameof(TrailSourceLinkRole.Duplicate))
            .And.Contain(nameof(ImportSessionStatus.AwaitingReview));
    }
}
