// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using WebDataContracts.RequestModels.Media;

namespace UnitTests.ServiceTests;

public class MediaReprocessServiceTests
{
    private sealed class RecordingQueue : IMediaReprocessQueue
    {
        public List<int> Enqueued { get; } = [];

        public void Enqueue(int itemId) => Enqueued.Add(itemId);

        public IAsyncEnumerable<int> DequeueAllAsync(CancellationToken ctoken) =>
            throw new NotSupportedException();
    }

    private static MediaReprocessService Build(
        Mock<IMediaReprocessRepository>? reprocess = null,
        Mock<IMediaRepository>? media = null,
        IMediaReprocessQueue? queue = null) =>
        new(
            (reprocess ?? new Mock<IMediaReprocessRepository>()).Object,
            (media ?? MediaRepoResolving()).Object,
            queue ?? new RecordingQueue(),
            NullLogger<MediaReprocessService>.Instance);

    private static Mock<IMediaRepository> MediaRepoResolving(params (string Identifier, string OwnerType)[] known)
    {
        var repo = new Mock<IMediaRepository>();
        repo.Setup(r => r.GetByIdentifiersAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IReadOnlyCollection<string> ids, CancellationToken _) =>
            {
                var matches = known.Length > 0
                    ? known.Where(k => ids.Contains(k.Identifier)).Select(k => new MediaLookupProjection(k.Identifier, k.OwnerType, $"{k.OwnerType.ToLower()}s/{k.Identifier}.jpg")).ToList()
                    : ids.Select(id => new MediaLookupProjection(id, "Trail", $"trails/{id}.jpg")).ToList();

                return RepositoryResult<IReadOnlyCollection<MediaLookupProjection>>.Success(matches);
            });

        return repo;
    }

    private static Mock<IMediaReprocessRepository> ReprocessRepoThatSaves(int firstItemId = 100)
    {
        var repo = new Mock<IMediaReprocessRepository>();
        repo.Setup(r => r.CreateJobAsync(
                It.IsAny<string>(),
                It.IsAny<IReadOnlyCollection<(string MediaIdentifier, string OwnerType)>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((string optionsJson, IReadOnlyCollection<(string MediaIdentifier, string OwnerType)> targets, CancellationToken _) =>
            {
                var id = firstItemId;
                var job = new MediaReprocessJob
                {
                    Id = 1,
                    Identifier = "job-1",
                    OptionsJson = optionsJson,
                    Items = targets.Select(t => new MediaReprocessItem
                    {
                        Id = id++,
                        MediaIdentifier = t.MediaIdentifier,
                        OwnerType = t.OwnerType,
                        Status = MediaReprocessItemStatus.Pending,
                    }).ToList(),
                };

                return RepositoryResult<MediaReprocessJob>.Success(job);
            });

        return repo;
    }

    private static ImageProcessingOptionsRequest Options() => new() { MaxWidth = 800 };

    private static CreateMediaReprocessJobRequest Request(string[] identifiers) =>
        new() { MediaIdentifiers = identifiers, Options = Options() };

    private static CreateMediaReprocessJobRequest FilterRequest(MediaFilter? filter = null) =>
        new() { Filter = filter ?? new MediaFilter { TargetMaxWidth = 800, TargetFormat = "webp" }, Options = Options() };

    private static Mock<IMediaRepository> MediaRepoMatching(int count)
    {
        var repo = MediaRepoResolving();
        repo.Setup(r => r.GetMatchingAsync(It.IsAny<MediaFilter>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MediaFilter _, int limit, CancellationToken __) =>
            {
                IReadOnlyCollection<MediaLookupProjection> matches = Enumerable.Range(1, Math.Min(count, limit))
                    .Select(i => new MediaLookupProjection($"trail-{i}", "Trail", $"trails/{i}.jpg"))
                    .ToList();

                return RepositoryResult<IReadOnlyCollection<MediaLookupProjection>>.Success(matches);
            });

        return repo;
    }

    [Fact]
    public async Task EnqueueBatchAsync_WithAllKnownTrailAndFacilityImages_CreatesTheJob()
    {
        // Arrange
        var reprocess = ReprocessRepoThatSaves();
        var media = MediaRepoResolving(("trail-1", "Trail"), ("facility-1", "Facility"));

        // Act
        var result = await Build(reprocess, media).EnqueueBatchAsync(
            Request(["trail-1", "facility-1"]), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.TotalCount.Should().Be(2);
        result.Value.PendingCount.Should().Be(2);
    }

    [Fact]
    public async Task EnqueueBatchAsync_WithAnUnresolvedIdentifier_FailsWithoutCreatingAJob()
    {
        // Arrange
        var reprocess = ReprocessRepoThatSaves();
        var media = MediaRepoResolving(("trail-1", "Trail"));

        // Act
        var result = await Build(reprocess, media).EnqueueBatchAsync(
            Request(["trail-1", "symbol-1"]), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message!.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Contain("symbol-1");

        reprocess.Verify(
            r => r.CreateJobAsync(It.IsAny<string>(), It.IsAny<IReadOnlyCollection<(string, string)>>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task EnqueueBatchAsync_DeduplicatesRepeatedIdentifiers()
    {
        // Arrange
        var reprocess = ReprocessRepoThatSaves();

        // Act
        var result = await Build(reprocess).EnqueueBatchAsync(
            Request(["trail-1", "trail-1"]), TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task EnqueueBatchAsync_WhenTheJobIsCreated_SignalsTheQueueWithEveryItemId()
    {
        // Arrange
        var queue = new RecordingQueue();
        var reprocess = ReprocessRepoThatSaves(firstItemId: 100);

        // Act
        await Build(reprocess, queue: queue).EnqueueBatchAsync(
            Request(["trail-1", "trail-2"]), TestContext.Current.CancellationToken);

        // Assert
        queue.Enqueued.Should().Equal(100, 101);
    }

    [Fact]
    public async Task EnqueueBatchAsync_SignalsTheQueueOnlyAfterTheJobIsCommitted()
    {
        // Arrange
        var queue = new RecordingQueue();
        var reprocess = new Mock<IMediaReprocessRepository>();
        var queueWasEmptyDuringCreate = false;

        reprocess.Setup(r => r.CreateJobAsync(
                It.IsAny<string>(), It.IsAny<IReadOnlyCollection<(string, string)>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string optionsJson, IReadOnlyCollection<(string MediaIdentifier, string OwnerType)> targets, CancellationToken _) =>
            {
                queueWasEmptyDuringCreate = queue.Enqueued.Count == 0;

                return RepositoryResult<MediaReprocessJob>.Success(new MediaReprocessJob
                {
                    Id = 1,
                    Identifier = "job-1",
                    OptionsJson = optionsJson,
                    Items = [new MediaReprocessItem { Id = 100, MediaIdentifier = "trail-1", OwnerType = "Trail", Status = MediaReprocessItemStatus.Pending }],
                });
            });

        // Act
        await Build(reprocess, queue: queue).EnqueueBatchAsync(Request(["trail-1"]), TestContext.Current.CancellationToken);

        // Assert
        queueWasEmptyDuringCreate.Should().BeTrue();
        queue.Enqueued.Should().Equal(100);
    }

    [Fact]
    public async Task EnqueueBatchAsync_FromAFilter_CreatesAJobForEveryMatch()
    {
        // Arrange
        var reprocess = ReprocessRepoThatSaves();
        var media = MediaRepoMatching(3);

        // Act
        var result = await Build(reprocess, media).EnqueueBatchAsync(
            FilterRequest(), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.TotalCount.Should().Be(3);

        media.Verify(
            r => r.GetByIdentifiersAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task EnqueueBatchAsync_FromAFilterMatchingNothing_FailsWithoutCreatingAJob()
    {
        // Arrange
        var reprocess = ReprocessRepoThatSaves();
        var media = MediaRepoMatching(0);

        // Act
        var result = await Build(reprocess, media).EnqueueBatchAsync(
            FilterRequest(), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);

        reprocess.Verify(
            r => r.CreateJobAsync(It.IsAny<string>(), It.IsAny<IReadOnlyCollection<(string, string)>>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task EnqueueBatchAsync_FromAFilterOverTheCap_IsRefusedRatherThanTruncated()
    {
        // Arrange
        var reprocess = ReprocessRepoThatSaves();
        var media = MediaRepoMatching(MediaReprocessLimits.MaxFilterBatchSize + 1);

        // Act
        var result = await Build(reprocess, media).EnqueueBatchAsync(
            FilterRequest(), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Contain(MediaReprocessLimits.MaxFilterBatchSize.ToString());

        reprocess.Verify(
            r => r.CreateJobAsync(It.IsAny<string>(), It.IsAny<IReadOnlyCollection<(string, string)>>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task EnqueueBatchAsync_FromAFilterExactlyAtTheCap_IsAccepted()
    {
        // Arrange
        var reprocess = ReprocessRepoThatSaves();
        var media = MediaRepoMatching(MediaReprocessLimits.MaxFilterBatchSize);

        // Act
        var result = await Build(reprocess, media).EnqueueBatchAsync(
            FilterRequest(), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task EnqueueBatchAsync_WithNeitherIdentifiersNorFilter_IsRefused()
    {
        // Arrange
        var reprocess = ReprocessRepoThatSaves();

        // Act
        var result = await Build(reprocess).EnqueueBatchAsync(
            new CreateMediaReprocessJobRequest { Options = Options() }, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task EnqueueBatchAsync_WithBothIdentifiersAndFilter_IsRefused()
    {
        // Arrange
        var reprocess = ReprocessRepoThatSaves();

        // Act
        var result = await Build(reprocess).EnqueueBatchAsync(
            new CreateMediaReprocessJobRequest
            {
                MediaIdentifiers = ["trail-1"],
                Filter = new MediaFilter { TargetMaxWidth = 800 },
                Options = Options()
            },
            TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task GetJobDetailAsync_ForAnUnknownJob_ReturnsNotFound()
    {
        // Arrange
        var reprocess = new Mock<IMediaReprocessRepository>();
        reprocess.Setup(r => r.GetJobCountsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<MediaReprocessJobCounts>.NotFound());

        // Act
        var result = await Build(reprocess).GetJobDetailAsync("no-such-job", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task CancelJobAsync_ForAnUnknownJob_ReturnsNotFound()
    {
        // Arrange
        var reprocess = new Mock<IMediaReprocessRepository>();
        reprocess.Setup(r => r.CancelPendingItemsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        // Act
        var result = await Build(reprocess).CancelJobAsync("no-such-job", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task CancelJobAsync_WhenSuccessful_ReturnsTheUpdatedCounts()
    {
        // Arrange
        var reprocess = new Mock<IMediaReprocessRepository>();
        reprocess.Setup(r => r.CancelPendingItemsAsync("job-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));
        reprocess.Setup(r => r.GetJobCountsAsync("job-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<MediaReprocessJobCounts>.Success(
                new MediaReprocessJobCounts("job-1", "{}", 2, 0, 0, 0, 0, 2, DateTime.UtcNow, DateTime.UtcNow)));

        // Act
        var result = await Build(reprocess).CancelJobAsync("job-1", TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.CancelledCount.Should().Be(2);
        result.Value.Status.Should().Be("Completed");
    }
}
