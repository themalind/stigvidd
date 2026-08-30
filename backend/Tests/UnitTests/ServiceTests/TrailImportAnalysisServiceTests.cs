// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Services;
using Core.TrailImport.Matching;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NetTopologySuite.Geometries;
using System.Text;

namespace UnitTests.ServiceTests;

/// <summary>
/// The analysis writes proposals and a session status and nothing else. Status is what
/// the admin UI polls, so a run that dies without moving it leaves the upload looking
/// like it is still working forever.
/// </summary>
public class TrailImportAnalysisServiceTests : IDisposable
{
    private readonly string _file = Path.Combine(Path.GetTempPath(), $"stigvidd-test-{Guid.NewGuid():N}.json");

    private const string TwoFeatures = """
    {
      "features": [
        { "properties": { "id": 100, "namn": "Samma som led 1" },
          "geometry": { "coordinates": [[12.85, 57.670], [12.85, 57.690]] } },
        { "properties": { "id": 200, "namn": "Ingenstans i narheten" },
          "geometry": { "coordinates": [[13.85, 58.670], [13.85, 58.690]] } }
      ]
    }
    """;

    private static LineString Line(params (double X, double Y)[] points) =>
        new([.. points.Select(p => new Coordinate(p.X, p.Y))]);

    public void Dispose()
    {
        if (File.Exists(_file)) File.Delete(_file);
        GC.SuppressFinalize(this);
    }

    private TrailImportSession WriteSession(string json)
    {
        File.WriteAllText(_file, json, Encoding.UTF8);

        return new TrailImportSession
        {
            Id = 12,
            Source = "boras-stad",
            FileName = "spar_leder.json",
            FileHash = "abc",
            StoredPath = _file,
            Status = ImportSessionStatus.Uploaded,
        };
    }

    private static Mock<ITrailImportRepository> Repository(
        TrailImportSession session,
        IReadOnlyCollection<TrailGeometry>? trails = null,
        IReadOnlyCollection<string>? excluded = null)
    {
        var repository = new Mock<ITrailImportRepository>();

        repository.Setup(r => r.GetSessionAsync(session.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailImportSession>.Success(session));

        repository.Setup(r => r.UpdateSessionAsync(It.IsAny<TrailImportSession>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        repository.Setup(r => r.GetTrailGeometriesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailGeometry>>.Success(trails ?? []));

        repository.Setup(r => r.GetExcludedFingerprintsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<string>>.Success(excluded ?? []));

        repository.Setup(r => r.ReplaceProposalsAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<TrailImportProposal>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        return repository;
    }

    private static TrailImportAnalysisService Build(Mock<ITrailImportRepository> repository) =>
        new(repository.Object, NullLogger<TrailImportAnalysisService>.Instance);

    private static Mock<ITrailImportRepository> CapturingProposals(
        Mock<ITrailImportRepository> repository,
        Action<IReadOnlyCollection<TrailImportProposal>> capture)
    {
        repository.Setup(r => r.ReplaceProposalsAsync(12, It.IsAny<IReadOnlyCollection<TrailImportProposal>>(), It.IsAny<CancellationToken>()))
            .Callback<int, IReadOnlyCollection<TrailImportProposal>, CancellationToken>((_, p, _) => capture(p))
            .ReturnsAsync(RepositoryResult.Success());

        return repository;
    }

    [Fact]
    public async Task AnalyzeAsync_ShouldWriteOneProposalPerFeature()
    {
        // Arrange
        var session = WriteSession(TwoFeatures);
        IReadOnlyCollection<TrailImportProposal>? saved = null;
        var repository = CapturingProposals(Repository(session), p => saved = p);

        // Act
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        saved.Should().HaveCount(2);
        session.FeatureCount.Should().Be(2);
    }

    [Fact]
    public async Task AnalyzeAsync_ForAFeatureMatchingATrailExactly_ShouldProposeItAsCertain()
    {
        // Arrange
        var session = WriteSession(TwoFeatures);
        var trail = new TrailGeometry(7, Line((12.85, 57.670), (12.85, 57.690)));
        IReadOnlyCollection<TrailImportProposal>? saved = null;
        var repository = CapturingProposals(Repository(session, [trail]), p => saved = p);

        // Act
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        var matched = saved!.Single(p => p.ExternalId == "100");
        matched.Confidence.Should().Be(MatchConfidence.Certain);
        matched.SuggestedTrailId.Should().Be(7);

        var unmatched = saved!.Single(p => p.ExternalId == "200");
        unmatched.Confidence.Should().Be(MatchConfidence.Unmatched);
        unmatched.SuggestedTrailId.Should().BeNull();
    }

    [Fact]
    public async Task AnalyzeAsync_ShouldLeaveEveryProposalPendingForTheReviewer()
    {
        // Arrange - the analysis suggests; the only row it decides by itself is one a
        // reviewer already excluded.
        var session = WriteSession(TwoFeatures);
        var trail = new TrailGeometry(7, Line((12.85, 57.670), (12.85, 57.690)));
        IReadOnlyCollection<TrailImportProposal>? saved = null;
        var repository = CapturingProposals(Repository(session, [trail]), p => saved = p);

        // Act
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        saved!.Should().OnlyContain(p => p.Decision == ProposalDecision.Pending);
        saved!.Should().OnlyContain(p => p.DecidedTrailId == null && p.CreatedTrailId == null);
    }

    [Fact]
    public async Task AnalyzeAsync_ForAFeatureExcludedInAnEarlierImport_ShouldBringItBackAlreadyExcluded()
    {
        // Arrange - without this the nine canoe routes come back Unmatched at every export
        // and have to be excluded again, forever.
        var session = WriteSession(TwoFeatures);
        var fingerprint = GeometryFingerprint.Compute(Line((12.85, 57.670), (12.85, 57.690)));
        IReadOnlyCollection<TrailImportProposal>? saved = null;
        var repository = CapturingProposals(Repository(session, excluded: [fingerprint]), p => saved = p);

        // Act
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        var decided = saved!.Single(p => p.ExternalId == "100");
        decided.Decision.Should().Be(ProposalDecision.Exclude);
        decided.DecidedRole.Should().Be(TrailSourceLinkRole.Excluded);
        decided.DecidedAt.Should().NotBeNull();
        decided.MatchReason.Should().Contain("excluded");

        saved!.Single(p => p.ExternalId == "200").Decision.Should().Be(ProposalDecision.Pending);
    }

    [Fact]
    public async Task AnalyzeAsync_ForAFeatureExcludedInAnEarlierImport_ShouldNotPointItAtATrail()
    {
        // Arrange - the feature has trail 7's exact geometry, which would otherwise make it
        // a Certain match. An excluded feature is linked to no trail at all.
        var session = WriteSession(TwoFeatures);
        var trail = new TrailGeometry(7, Line((12.85, 57.670), (12.85, 57.690)));
        var fingerprint = GeometryFingerprint.Compute(trail.Geometry);
        IReadOnlyCollection<TrailImportProposal>? saved = null;
        var repository = CapturingProposals(Repository(session, [trail], [fingerprint]), p => saved = p);

        // Act
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        var decided = saved!.Single(p => p.ExternalId == "100");
        decided.SuggestedTrailId.Should().BeNull();
        decided.NearestTrailId.Should().BeNull();
        decided.Confidence.Should().Be(MatchConfidence.Unmatched);
    }

    [Fact]
    public async Task AnalyzeAsync_ShouldLookTheExclusionsUpForTheSessionsOwnSource()
    {
        // Arrange - a fingerprint only identifies a feature within one source.
        var session = WriteSession(TwoFeatures);
        var repository = Repository(session);

        // Act
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        repository.Verify(r => r.GetExcludedFingerprintsAsync("boras-stad", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AnalyzeAsync_WhenTheExcludedLinksCannotBeRead_ShouldFailRatherThanQueueDecidedFeaturesAgain()
    {
        // Arrange - an empty list and a failed query look identical here, and one of them
        // puts every earlier exclusion back in the queue as if it were new.
        var session = WriteSession(TwoFeatures);
        var repository = Repository(session);

        repository.Setup(r => r.GetExcludedFingerprintsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<string>>.Error());

        // Act
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        session.Status.Should().Be(ImportSessionStatus.Failed);
        repository.Verify(r => r.ReplaceProposalsAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<TrailImportProposal>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AnalyzeAsync_ShouldKeepThePropertiesAndGeometryOnTheProposal()
    {
        // Arrange - the review view reads these instead of opening the uploaded file again.
        var session = WriteSession(TwoFeatures);
        IReadOnlyCollection<TrailImportProposal>? saved = null;
        var repository = CapturingProposals(Repository(session), p => saved = p);

        // Act
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        var proposal = saved!.Single(p => p.ExternalId == "100");
        proposal.FeatureProperties.Should().Contain("namn");
        proposal.FeatureGeometry.Should().NotBeNull();
        proposal.GeometryFingerprint.Should().HaveLength(64);
    }

    [Fact]
    public async Task AnalyzeAsync_WhenItSucceeds_ShouldLeaveTheSessionAwaitingReview()
    {
        // Arrange
        var session = WriteSession(TwoFeatures);

        // Act
        await Build(Repository(session)).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        session.Status.Should().Be(ImportSessionStatus.AwaitingReview);
        session.AnalyzedAt.Should().NotBeNull();
        session.ErrorMessage.Should().BeNull();
    }

    [Fact]
    public async Task AnalyzeAsync_WhenTheFileIsMissing_ShouldFailTheSessionWithAReason()
    {
        // Arrange - the stored file was cleaned up, or never landed.
        var session = WriteSession(TwoFeatures);
        session.StoredPath = Path.Combine(Path.GetTempPath(), "stigvidd-does-not-exist.json");

        // Act
        await Build(Repository(session)).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        session.Status.Should().Be(ImportSessionStatus.Failed);
        session.ErrorMessage.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task AnalyzeAsync_WhenTheTrailsCannotBeRead_ShouldFailRatherThanProposeEverythingAsNew()
    {
        // Arrange - an empty candidate list and a failed query look identical to the
        // matcher, and one of them would propose creating all 203 trails afresh.
        var session = WriteSession(TwoFeatures);
        var repository = Repository(session);

        repository.Setup(r => r.GetTrailGeometriesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailGeometry>>.Error());

        // Act
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        session.Status.Should().Be(ImportSessionStatus.Failed);
        repository.Verify(r => r.ReplaceProposalsAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<TrailImportProposal>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AnalyzeAsync_WhenTheProposalsCannotBeSaved_ShouldFailTheSession()
    {
        // Arrange
        var session = WriteSession(TwoFeatures);
        var repository = Repository(session);

        repository.Setup(r => r.ReplaceProposalsAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<TrailImportProposal>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        // Act
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        session.Status.Should().Be(ImportSessionStatus.Failed);
    }

    [Fact]
    public async Task AnalyzeAsync_ForAnUnknownSession_ShouldDoNothing()
    {
        // Arrange
        var repository = new Mock<ITrailImportRepository>();
        repository.Setup(r => r.GetSessionAsync(99, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailImportSession>.NotFound());

        // Act
        await Build(repository).AnalyzeAsync(99, CancellationToken.None);

        // Assert
        repository.Verify(r => r.UpdateSessionAsync(It.IsAny<TrailImportSession>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AnalyzeAsync_RunTwice_ShouldReplaceTheProposalsRatherThanAddToThem()
    {
        // Arrange - re-running a session must not leave two rows per feature.
        var session = WriteSession(TwoFeatures);
        var repository = Repository(session);

        // Act
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);
        await Build(repository).AnalyzeAsync(12, CancellationToken.None);

        // Assert
        repository.Verify(r => r.ReplaceProposalsAsync(12, It.IsAny<IReadOnlyCollection<TrailImportProposal>>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        session.FeatureCount.Should().Be(2);
    }

    [Fact]
    public async Task FailInterruptedSessionsAsync_ShouldSayWhyTheRunStopped()
    {
        // Arrange
        var repository = new Mock<ITrailImportRepository>();
        string? message = null;

        repository.Setup(r => r.FailInterruptedSessionsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, CancellationToken>((m, _) => message = m)
            .ReturnsAsync(RepositoryResult<int>.Success(1));

        // Act
        await Build(repository).FailInterruptedSessionsAsync(CancellationToken.None);

        // Assert — the reviewer reads this instead of watching a spinner that never stops.
        message.Should().Contain("restart");
    }

    [Fact]
    public async Task FailInterruptedSessionsAsync_WhenTheRepositoryFails_ShouldNotThrow()
    {
        // Arrange — this runs as the worker starts, so a database that is not up yet must
        // not take the worker down with it.
        var repository = new Mock<ITrailImportRepository>();

        repository.Setup(r => r.FailInterruptedSessionsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error());

        // Act
        var act = () => Build(repository).FailInterruptedSessionsAsync(CancellationToken.None);

        // Assert
        await act.Should().NotThrowAsync();
    }
}
