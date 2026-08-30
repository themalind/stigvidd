// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Apply;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using AwesomeAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NetTopologySuite.Geometries;
using StigviddAPI;

namespace IntegrationTests.TrailImport;

/// <summary>
/// The apply phase, which is the only part of the sync that writes to Trails. It runs in a
/// transaction and turns proposals into source links, so it belongs here rather than in the
/// unit suite: the in-memory provider supports neither.
/// </summary>
public class TrailImportApplyIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const int TivedenId = 1;
    private const string Source = "boras-stad";

    private const string SourceProperties =
        """{"id":4456,"namn":"Tiveden vandringsled 9,5 km","klassning":"Svår","sparmarkering":"Röd markering","tillganglighet":"NEJ","tillg_text":"Delvis väldigt svår terräng, kräver god fysik"}""";

    private static readonly LineString Line = GeoPointFactory.FromLonLatPath(
    [
        new Coordinate(12.805, 57.621),
        new Coordinate(12.806, 57.622),
    ]);

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public TrailImportApplyIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private (ITrailImportService Service, StigViddDbContext Context) Resolve()
    {
        var scope = _factory.Services.CreateScope();
        var contextFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>();

        return (scope.ServiceProvider.GetRequiredService<ITrailImportService>(), contextFactory.CreateDbContext());
    }

    private static int CreateSession(
        StigViddDbContext context,
        ImportSessionStatus status = ImportSessionStatus.AwaitingReview,
        string? storedPath = null)
    {
        var session = new TrailImportSession
        {
            Source = Source,
            FileName = "spar_leder.json",
            FileHash = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"),
            StoredPath = storedPath ?? $"/tmp/{Guid.NewGuid():N}.geojson",
            Status = status,
        };

        context.TrailImportSessions.Add(session);
        context.SaveChanges();

        return session.Id;
    }

    private static TrailImportProposal Decide(
        StigViddDbContext context,
        int sessionId,
        ProposalDecision decision,
        int? trailId = null,
        string fingerprint = "fingerprint-1",
        string? properties = null,
        string? decidedName = null,
        decimal? decidedLengthKm = null,
        LineString? geometry = null)
    {
        var proposal = new TrailImportProposal
        {
            SessionId = sessionId,
            ExternalId = "4456",
            FeatureName = "Tiveden vandringsled 9,5 km",
            GeometryFingerprint = fingerprint,
            FeatureProperties = properties ?? SourceProperties,
            FeatureGeometry = geometry ?? Line,
            SuggestedTrailId = decision == ProposalDecision.Accept ? trailId : null,
            DecidedTrailId = decision == ProposalDecision.Relink ? trailId : null,
            Confidence = MatchConfidence.High,
            CoverageForward = 0.98,
            CoverageBackward = 0.99,
            Decision = decision,
            DecidedRole = TrailSourceLinkRole.Segment,
            DecidedBy = "granskare",
            DecidedAt = DateTime.UtcNow,
            DecidedName = decidedName,
            DecidedLengthKm = decidedLengthKm,
        };

        context.TrailImportProposals.Add(proposal);
        context.SaveChanges();

        return proposal;
    }

    private static void LinkOnFile(StigViddDbContext context, string fingerprint, int trailId, string snapshot)
    {
        context.TrailSourceLinks.Add(new TrailSourceLink
        {
            Source = Source,
            GeometryFingerprint = fingerprint,
            TrailId = trailId,
            Role = TrailSourceLinkRole.Segment,
            Confidence = MatchConfidence.High,
            SourceSnapshot = snapshot,
            ConfirmedByHuman = true,
            LastSeenAt = DateTime.UtcNow.AddDays(-30),
        });

        context.SaveChanges();
    }

    [Fact]
    public async Task ApplyAsync_OnTheFirstSync_ShouldWriteTheLinkAndLeaveTheTrailAlone()
    {
        // Arrange — the source says Svår and a long name; the trail is curated and says
        // otherwise. With no snapshot on file there is nothing to tell an edit from an import.
        var (service, context) = Resolve();
        var sessionId = CreateSession(context);

        Decide(context, sessionId, ProposalDecision.Accept, TivedenId);

        var before = await context.Trails.AsNoTracking().SingleAsync(t => t.Id == TivedenId, TestContext.Current.CancellationToken);

        // Act
        var result = await service.ApplyAsync(sessionId, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.LinksWritten.Should().Be(1);
        result.Value.TrailsUpdated.Should().Be(0);

        var after = await context.Trails.AsNoTracking().SingleAsync(t => t.Id == TivedenId, TestContext.Current.CancellationToken);
        after.Name.Should().Be(before.Name);
        after.TrailLength.Should().Be(before.TrailLength);
        after.Classification.Should().Be(before.Classification);

        var link = await context.TrailSourceLinks.AsNoTracking()
            .SingleAsync(l => l.Source == Source, TestContext.Current.CancellationToken);

        link.TrailId.Should().Be(TivedenId);
        link.ConfirmedByHuman.Should().BeTrue();
        link.SourceSnapshot.Should().Be(SourceProperties);
        link.LastSeenExternalId.Should().Be("4456");
    }

    [Fact]
    public async Task ApplyAsync_OnASecondSyncWhereOnlyTheSourceChanged_ShouldTakeTheSourcesValue()
    {
        // Arrange — the snapshot matches the trail, so nothing local has been edited.
        var (service, context) = Resolve();
        var sessionId = CreateSession(context);

        LinkOnFile(context, "fingerprint-1", TivedenId, SourceProperties);

        Decide(context, sessionId, ProposalDecision.Accept, TivedenId,
            properties: SourceProperties.Replace("Röd markering", "Blå markering"));

        // Act
        var result = await service.ApplyAsync(sessionId, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.TrailsUpdated.Should().Be(1);
        result.Value.Conflicts.Should().BeEmpty();

        var trail = await context.Trails.AsNoTracking().SingleAsync(t => t.Id == TivedenId, TestContext.Current.CancellationToken);
        trail.TrailSymbol.Should().Be("Blå markering");

        // The link is updated, not duplicated: one feature, one row.
        var links = await context.TrailSourceLinks.AsNoTracking()
            .Where(l => l.Source == Source).ToListAsync(TestContext.Current.CancellationToken);

        links.Should().ContainSingle().Which.SourceSnapshot.Should().Contain("Blå markering");
    }

    [Fact]
    public async Task ApplyAsync_OnASecondSyncWhereBothSidesChanged_ShouldKeepOursAndReportTheConflict()
    {
        // Arrange — the trail's symbol was edited after the last import, and the source has
        // moved on too.
        var (service, context) = Resolve();
        var sessionId = CreateSession(context);

        LinkOnFile(context, "fingerprint-1", TivedenId,
            SourceProperties.Replace("Röd markering", "Grön markering"));

        Decide(context, sessionId, ProposalDecision.Accept, TivedenId,
            properties: SourceProperties.Replace("Röd markering", "Blå markering"));

        // Act
        var result = await service.ApplyAsync(sessionId, TestContext.Current.CancellationToken);

        // Assert
        var conflict = result.Value!.Conflicts.Should().ContainSingle().Subject;
        conflict.Field.Should().Be("TrailSymbol");
        conflict.Ours.Should().Be("Röd markering");
        conflict.Theirs.Should().Be("Blå markering");

        var trail = await context.Trails.AsNoTracking().SingleAsync(t => t.Id == TivedenId, TestContext.Current.CancellationToken);
        trail.TrailSymbol.Should().Be("Röd markering");
    }

    [Fact]
    public async Task ApplyAsync_ForACreateNewFeature_ShouldCreateAnUnpublishedTrailAndRecordItOnTheProposal()
    {
        // Arrange
        var (service, context) = Resolve();
        var sessionId = CreateSession(context);

        var proposal = Decide(context, sessionId, ProposalDecision.CreateNew,
            decidedName: "Bredareds IF Vit", decidedLengthKm: 13m);

        // Act
        var result = await service.ApplyAsync(sessionId, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.TrailsCreated.Should().Be(1);

        var trail = await context.Trails.AsNoTracking()
            .SingleAsync(t => t.Name == "Bredareds IF Vit", TestContext.Current.CancellationToken);

        trail.TrailLength.Should().Be(13m);
        trail.TrailSymbol.Should().Be("Röd markering");
        trail.GeoPath.Should().NotBeNull();

        // Not published until someone has looked at it: the app lists neither unverified
        // trails nor ones without a route.
        trail.IsVerified.Should().BeFalse();

        var written = await context.TrailImportProposals.AsNoTracking()
            .SingleAsync(p => p.Id == proposal.Id, TestContext.Current.CancellationToken);

        written.CreatedTrailId.Should().Be(trail.Id);

        var link = await context.TrailSourceLinks.AsNoTracking()
            .SingleAsync(l => l.Source == Source, TestContext.Current.CancellationToken);

        link.TrailId.Should().Be(trail.Id);
    }

    [Fact]
    public async Task ApplyAsync_ForAnAcceptWithAChosenLength_ShouldWriteThatFigureAndOnlyThat()
    {
        // Arrange — the source's own length is never read for an existing trail.
        var (service, context) = Resolve();
        var sessionId = CreateSession(context);

        Decide(context, sessionId, ProposalDecision.Accept, TivedenId, decidedLengthKm: 15.72m);

        // Act
        await service.ApplyAsync(sessionId, TestContext.Current.CancellationToken);

        // Assert
        var trail = await context.Trails.AsNoTracking().SingleAsync(t => t.Id == TivedenId, TestContext.Current.CancellationToken);
        trail.TrailLength.Should().Be(15.72m);
        trail.Name.Should().Be("Tiveden");
    }

    [Fact]
    public async Task ApplyAsync_OnAnAppliedSession_ShouldBeANoOpAndGiveBackTheStoredReport()
    {
        // Arrange
        var (service, context) = Resolve();
        var sessionId = CreateSession(context);

        Decide(context, sessionId, ProposalDecision.Accept, TivedenId);

        var first = await service.ApplyAsync(sessionId, TestContext.Current.CancellationToken);

        // Act
        var second = await service.ApplyAsync(sessionId, TestContext.Current.CancellationToken);

        // Assert
        second.Success.Should().BeTrue();
        second.Value!.LinksWritten.Should().Be(first.Value!.LinksWritten);

        var links = await context.TrailSourceLinks.AsNoTracking()
            .Where(l => l.Source == Source).ToListAsync(TestContext.Current.CancellationToken);

        links.Should().ContainSingle();
    }

    [Fact]
    public async Task ApplyAsync_OnASessionWhereNothingWasDecided_ShouldRefuse()
    {
        // Arrange
        var (service, context) = Resolve();
        var sessionId = CreateSession(context);

        Decide(context, sessionId, ProposalDecision.Pending, TivedenId);

        // Act
        var result = await service.ApplyAsync(sessionId, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(409);

        var session = await context.TrailImportSessions.AsNoTracking()
            .SingleAsync(s => s.Id == sessionId, TestContext.Current.CancellationToken);

        session.Status.Should().Be(ImportSessionStatus.AwaitingReview);
        session.AppliedAt.Should().BeNull();
    }

    [Fact]
    public async Task ApplySessionAsync_OnASessionThatIsNoLongerAwaitingReview_ShouldWriteNothing()
    {
        // Arrange — the service checks the status before it reads the session, so two
        // requests can both get past it. The transaction re-reads and is the one that holds.
        var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<ITrailImportRepository>();
        var context = scope.ServiceProvider.GetRequiredService<IDbContextFactory<StigViddDbContext>>().CreateDbContext();

        var sessionId = CreateSession(context, ImportSessionStatus.Applied);

        var writes = new ApplyWriteSet(
            [new TrailCreate(1, "Skulle inte skrivas", 1m, Line, 0, false, string.Empty, string.Empty)],
            [],
            [],
            []);

        // Act
        var result = await repository.ApplySessionAsync(sessionId, writes, "{}", TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.Conflict);

        var written = await context.Trails.AsNoTracking()
            .AnyAsync(t => t.Name == "Skulle inte skrivas", TestContext.Current.CancellationToken);

        written.Should().BeFalse();
    }

    [Fact]
    public async Task QueueAnalysisAsync_WhenDecisionsWouldBeDiscarded_ShouldRefuseUntilForced()
    {
        // Arrange — a new analysis replaces every proposal, decisions and all.
        var file = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.geojson");
        await File.WriteAllTextAsync(file, "{}", TestContext.Current.CancellationToken);

        try
        {
            var (service, context) = Resolve();
            var sessionId = CreateSession(context, ImportSessionStatus.AwaitingReview, file);

            Decide(context, sessionId, ProposalDecision.Accept, TivedenId);

            // Act
            var refused = await service.QueueAnalysisAsync(sessionId, force: false, TestContext.Current.CancellationToken);
            var forced = await service.QueueAnalysisAsync(sessionId, force: true, TestContext.Current.CancellationToken);

            // Assert
            refused.Success.Should().BeFalse();
            refused.Message!.StatusCode.Should().Be(409);
            refused.Message.ResultMessage.Should().Contain("1 decision");

            forced.Success.Should().BeTrue();
        }
        finally
        {
            File.Delete(file);
        }
    }
}
