// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.RepositoryTests;

public class MediaReprocessRepositoryTests : TestBase
{
    private static MediaReprocessRepository Build(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<MediaReprocessRepository>.Instance);

    private static MediaReprocessItem MakeItem(
        int id, int jobId, string mediaIdentifier, string ownerType, MediaReprocessItemStatus status = MediaReprocessItemStatus.Pending) =>
        new()
        {
            Id = id,
            JobId = jobId,
            Identifier = $"item-{id}",
            MediaIdentifier = mediaIdentifier,
            OwnerType = ownerType,
            Status = status,
            CreatedAt = Utilities.SeedDates.Created,
            LastUpdatedAt = Utilities.SeedDates.Updated,
        };

    private static MediaReprocessJob MakeJob(int id, DateTime? createdAt = null, params MediaReprocessItem[] items) =>
        new()
        {
            Id = id,
            Identifier = $"job-{id}",
            OptionsJson = "{}",
            CreatedAt = createdAt ?? Utilities.SeedDates.Created,
            LastUpdatedAt = Utilities.SeedDates.Updated,
            Items = items,
        };

    [Fact]
    public async Task CreateJobAsync_CreatesOneItemPerTarget_AllPending()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());

        // Act
        var result = await repo.CreateJobAsync(
            "{\"MaxWidth\":800}",
            [("trail-image-1", "Trail"), ("facility-image-1", "Facility")],
            TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Items.Should().HaveCount(2);
        result.Value.Items.Should().OnlyContain(i => i.Status == MediaReprocessItemStatus.Pending);
        result.Value.Items.Select(i => i.Id).Should().OnlyContain(id => id > 0);
    }

    [Fact]
    public async Task ClaimAsync_APendingItem_MovesItToProcessing()
    {
        // Arrange
        var job = MakeJob(1, items: MakeItem(1, 1, "media-1", "Trail"));
        var repo = Build(CreateSeededFactory(db => db.MediaReprocessJobs.Add(job)));

        // Act
        var result = await repo.ClaimAsync(1, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Status.Should().Be(MediaReprocessItemStatus.Processing);
    }

    [Theory]
    [InlineData(MediaReprocessItemStatus.Processing)]
    [InlineData(MediaReprocessItemStatus.Succeeded)]
    [InlineData(MediaReprocessItemStatus.Failed)]
    [InlineData(MediaReprocessItemStatus.Cancelled)]
    public async Task ClaimAsync_AnAlreadySettledOrClaimedItem_IsAConflict(MediaReprocessItemStatus from)
    {
        // Arrange
        var job = MakeJob(1, items: MakeItem(1, 1, "media-1", "Trail", from));
        var repo = Build(CreateSeededFactory(db => db.MediaReprocessJobs.Add(job)));

        // Act
        var result = await repo.ClaimAsync(1, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task MarkSucceededAsync_ActuallyUpdatesTheOwningTrailImageRow()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        using (var seed = new StigViddDbContext(options))
        {
            seed.Database.EnsureCreated();
            seed.TrailImages.Add(new TrailImage { Id = 10, Identifier = "media-1", ImageUrl = "trails/old.jpg", TrailId = 1, Width = 100, Height = 100, SizeBytes = 999 });
            seed.MediaReprocessJobs.Add(MakeJob(1, items: MakeItem(1, 1, "media-1", "Trail")));
            seed.SaveChanges();
        }

        var mock = new Moq.Mock<IDbContextFactory<StigViddDbContext>>();
        mock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(options));
        var repo = Build(mock.Object);

        // Act
        await repo.MarkSucceededAsync(1, "trails/old.jpg", "trails/new.jpg", 400, 300, 12345, TestContext.Current.CancellationToken);

        // Assert
        using var verify = new StigViddDbContext(options);
        var updated = await verify.TrailImages.FirstAsync(ti => ti.Identifier == "media-1", TestContext.Current.CancellationToken);
        updated.ImageUrl.Should().Be("trails/new.jpg");
        updated.Width.Should().Be(400);
        updated.Height.Should().Be(300);
        updated.SizeBytes.Should().Be(12345);
    }

    [Fact]
    public async Task MarkFailedAsync_RecordsTheError()
    {
        // Arrange
        var job = MakeJob(1, items: MakeItem(1, 1, "media-1", "Trail", MediaReprocessItemStatus.Processing));
        var repo = Build(CreateSeededFactory(db => db.MediaReprocessJobs.Add(job)));

        // Act
        var result = await repo.MarkFailedAsync(1, "Source file missing.", TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();

        var items = await repo.GetJobItemsAsync("job-1", TestContext.Current.CancellationToken);
        items.Value.Should().ContainSingle(i => i.Status == MediaReprocessItemStatus.Failed && i.LastError == "Source file missing.");
    }

    [Fact]
    public async Task ResetInterruptedAsync_MovesProcessingItemsBackToPending()
    {
        // Arrange
        var job = MakeJob(1,
            items:
            [
                MakeItem(1, 1, "media-1", "Trail", MediaReprocessItemStatus.Processing),
                MakeItem(2, 1, "media-2", "Trail", MediaReprocessItemStatus.Succeeded),
            ]);
        var repo = Build(CreateSeededFactory(db => db.MediaReprocessJobs.Add(job)));

        // Act
        var result = await repo.ResetInterruptedAsync(TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(1);

        var items = await repo.GetJobItemsAsync("job-1", TestContext.Current.CancellationToken);
        items.Value.Should().Contain(i => i.MediaIdentifier == "media-1" && i.Status == MediaReprocessItemStatus.Pending);
        items.Value.Should().Contain(i => i.MediaIdentifier == "media-2" && i.Status == MediaReprocessItemStatus.Succeeded);
    }

    [Fact]
    public async Task GetPendingItemIdsAsync_ReturnsOnlyPendingOldestFirst()
    {
        // Arrange
        var job = MakeJob(1,
            items:
            [
                MakeItem(1, 1, "media-1", "Trail", MediaReprocessItemStatus.Succeeded),
                MakeItem(2, 1, "media-2", "Trail", MediaReprocessItemStatus.Pending),
                MakeItem(3, 1, "media-3", "Trail", MediaReprocessItemStatus.Pending),
            ]);
        var repo = Build(CreateSeededFactory(db => db.MediaReprocessJobs.Add(job)));

        // Act
        var result = await repo.GetPendingItemIdsAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().Equal(2, 3);
    }

    [Fact]
    public async Task CancelPendingItemsAsync_CancelsOnlyPendingItemsOfThatJob()
    {
        // Arrange
        var job = MakeJob(1,
            items:
            [
                MakeItem(1, 1, "media-1", "Trail", MediaReprocessItemStatus.Pending),
                MakeItem(2, 1, "media-2", "Trail", MediaReprocessItemStatus.Processing),
            ]);
        var otherJob = MakeJob(2, items: MakeItem(3, 2, "media-3", "Trail", MediaReprocessItemStatus.Pending));
        var repo = Build(CreateSeededFactory(db =>
        {
            db.MediaReprocessJobs.Add(job);
            db.MediaReprocessJobs.Add(otherJob);
        }));

        // Act
        var result = await repo.CancelPendingItemsAsync("job-1", TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(1);

        var items = await repo.GetJobItemsAsync("job-1", TestContext.Current.CancellationToken);
        items.Value.Should().Contain(i => i.MediaIdentifier == "media-1" && i.Status == MediaReprocessItemStatus.Cancelled);
        items.Value.Should().Contain(i => i.MediaIdentifier == "media-2" && i.Status == MediaReprocessItemStatus.Processing);

        var otherItems = await repo.GetJobItemsAsync("job-2", TestContext.Current.CancellationToken);
        otherItems.Value.Should().Contain(i => i.Status == MediaReprocessItemStatus.Pending);
    }

    [Fact]
    public async Task CancelPendingItemsAsync_ForAnUnknownJob_IsNotFound()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());

        // Act
        var result = await repo.CancelPendingItemsAsync("no-such-job", TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task GetJobCountsAsync_AggregatesEachStatus()
    {
        // Arrange
        var job = MakeJob(1,
            items:
            [
                MakeItem(1, 1, "media-1", "Trail", MediaReprocessItemStatus.Pending),
                MakeItem(2, 1, "media-2", "Trail", MediaReprocessItemStatus.Processing),
                MakeItem(3, 1, "media-3", "Trail", MediaReprocessItemStatus.Succeeded),
                MakeItem(4, 1, "media-4", "Trail", MediaReprocessItemStatus.Failed),
                MakeItem(5, 1, "media-5", "Trail", MediaReprocessItemStatus.Cancelled),
            ]);
        var repo = Build(CreateSeededFactory(db => db.MediaReprocessJobs.Add(job)));

        // Act
        var result = await repo.GetJobCountsAsync("job-1", TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.TotalCount.Should().Be(5);
        result.Value.PendingCount.Should().Be(1);
        result.Value.ProcessingCount.Should().Be(1);
        result.Value.SucceededCount.Should().Be(1);
        result.Value.FailedCount.Should().Be(1);
        result.Value.CancelledCount.Should().Be(1);
    }

    [Fact]
    public async Task GetJobsPagedAsync_OrdersNewestFirst()
    {
        // Arrange
        var older = MakeJob(1, createdAt: DateTime.UtcNow.AddDays(-2), items: MakeItem(1, 1, "media-1", "Trail"));
        var newer = MakeJob(2, createdAt: DateTime.UtcNow.AddDays(-1), items: MakeItem(2, 2, "media-2", "Trail"));
        var repo = Build(CreateSeededFactory(db =>
        {
            db.MediaReprocessJobs.Add(older);
            db.MediaReprocessJobs.Add(newer);
        }));

        // Act
        var result = await repo.GetJobsPagedAsync(1, 10, TestContext.Current.CancellationToken);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.Items.Select(j => j.Identifier).Should().Equal("job-2", "job-1");
        result.Value.TotalCount.Should().Be(2);
    }

    [Fact]
    public void PurgeableSettled_MatchesAnOldJobWhoseItemsAreAllSettled()
    {
        var cutoff = DateTime.UtcNow.AddDays(-30);
        var job = MakeJob(1, createdAt: cutoff.AddDays(-1), items: MakeItem(1, 1, "media-1", "Trail", MediaReprocessItemStatus.Succeeded));

        new[] { job }.AsQueryable()
            .Where(MediaReprocessRepository.PurgeableSettled(cutoff))
            .Should().ContainSingle();
    }

    [Fact]
    public void PurgeableSettled_SparesAJobStillBeingWorked()
    {
        var cutoff = DateTime.UtcNow.AddDays(-30);
        var job = MakeJob(1,
            createdAt: cutoff.AddDays(-1),
            items:
            [
                MakeItem(1, 1, "media-1", "Trail", MediaReprocessItemStatus.Succeeded),
                MakeItem(2, 1, "media-2", "Trail", MediaReprocessItemStatus.Pending),
            ]);

        new[] { job }.AsQueryable()
            .Where(MediaReprocessRepository.PurgeableSettled(cutoff))
            .Should().BeEmpty();
    }

    [Fact]
    public void PurgeableSettled_SparesAJobCreatedAfterTheCutoff()
    {
        var cutoff = DateTime.UtcNow.AddDays(-30);
        var job = MakeJob(1, createdAt: cutoff.AddDays(1), items: MakeItem(1, 1, "media-1", "Trail", MediaReprocessItemStatus.Succeeded));

        new[] { job }.AsQueryable()
            .Where(MediaReprocessRepository.PurgeableSettled(cutoff))
            .Should().BeEmpty();
    }

    private static TrailImage MakeTrailImage(int id, string identifier, string imageUrl) =>
        new() { Id = id, Identifier = identifier, ImageUrl = imageUrl, TrailId = 1, Width = 4000, Height = 3000, SizeBytes = 5_000_000 };

    [Fact]
    public async Task MarkSucceededAsync_RepointsEveryRowSharingTheOldFile_AndSettlesTheirPendingItems()
    {
        // Arrange
        var job = MakeJob(900,
            items:
            [
                MakeItem(901, 900, "shared-a", "Trail", MediaReprocessItemStatus.Processing),
                MakeItem(902, 900, "shared-b", "Trail"),
                MakeItem(903, 900, "shared-c", "Trail"),
                MakeItem(904, 900, "unrelated", "Trail"),
            ]);
        var factory = CreateSeededFactory(db =>
        {
            db.TrailImages.Add(MakeTrailImage(9001, "shared-a", "mock/placeholder.jpg"));
            db.TrailImages.Add(MakeTrailImage(9002, "shared-b", "mock/placeholder.jpg"));
            db.TrailImages.Add(MakeTrailImage(9003, "shared-c", "/mock/placeholder.jpg"));
            db.TrailImages.Add(MakeTrailImage(9004, "unrelated", "trails/other.jpg"));
            db.MediaReprocessJobs.Add(job);
        });
        var repo = Build(factory);

        // Act
        var result = await repo.MarkSucceededAsync(
            901, "mock/placeholder.jpg", "trails/new.webp", 800, 600, 40_000, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.RowsRepointed.Should().Be(3);
        result.Value.OldFileStillReferenced.Should().BeFalse();

        using var verify = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var urls = await verify.TrailImages
            .Where(ti => ti.Id >= 9001 && ti.Id <= 9004)
            .ToDictionaryAsync(ti => ti.Identifier, ti => ti.ImageUrl, TestContext.Current.CancellationToken);
        urls["shared-a"].Should().Be("trails/new.webp");
        urls["shared-b"].Should().Be("trails/new.webp");
        urls["shared-c"].Should().Be("trails/new.webp");
        urls["unrelated"].Should().Be("trails/other.jpg");

        var items = await repo.GetJobItemsAsync("job-900", TestContext.Current.CancellationToken);
        items.Value.Should().NotBeNull();
        items.Value.Where(i => i.MediaIdentifier.StartsWith("shared-"))
            .Should().OnlyContain(i => i.Status == MediaReprocessItemStatus.Succeeded);
        items.Value.Should().ContainSingle(i => i.MediaIdentifier == "unrelated" && i.Status == MediaReprocessItemStatus.Pending);
    }

    [Fact]
    public async Task MarkSucceededAsync_SettlesAFailedOrCancelledSiblingInTheJob_SoARetryDoesNotReEncodeTheOutput()
    {
        // Arrange
        var failed = MakeItem(932, 930, "shared-failed", "Trail", MediaReprocessItemStatus.Failed);
        failed.LastError = "Download: 404";
        var job = MakeJob(930,
            items:
            [
                MakeItem(931, 930, "shared-a", "Trail", MediaReprocessItemStatus.Processing),
                failed,
                MakeItem(933, 930, "shared-cancelled", "Trail", MediaReprocessItemStatus.Cancelled),
            ]);
        var repo = Build(CreateSeededFactory(db =>
        {
            db.TrailImages.Add(MakeTrailImage(9301, "shared-a", "trails/shared.jpg"));
            db.TrailImages.Add(MakeTrailImage(9302, "shared-failed", "trails/shared.jpg"));
            db.TrailImages.Add(MakeTrailImage(9303, "shared-cancelled", "/trails/shared.jpg"));
            db.MediaReprocessJobs.Add(job);
        }));

        // Act
        await repo.MarkSucceededAsync(
            931, "trails/shared.jpg", "trails/new.webp", 800, 600, 40_000, TestContext.Current.CancellationToken);

        // Assert
        var items = await repo.GetJobItemsAsync("job-930", TestContext.Current.CancellationToken);
        items.Value.Should().NotBeNull();
        items.Value.Should().OnlyContain(i => i.Status == MediaReprocessItemStatus.Succeeded && i.LastError == null);
    }

    [Fact]
    public async Task MarkSucceededAsync_SettlesAPendingItemInAnotherJobOnTheSameFile_ButLeavesItsFailuresAlone()
    {
        // Arrange
        var otherFailed = MakeItem(943, 942, "shared-c", "Trail", MediaReprocessItemStatus.Failed);
        otherFailed.LastError = "Upload: 500";
        var repo = Build(CreateSeededFactory(db =>
        {
            db.TrailImages.Add(MakeTrailImage(9401, "shared-a", "trails/shared.jpg"));
            db.TrailImages.Add(MakeTrailImage(9402, "shared-b", "trails/shared.jpg"));
            db.TrailImages.Add(MakeTrailImage(9403, "shared-c", "trails/shared.jpg"));
            db.MediaReprocessJobs.Add(MakeJob(940, items: MakeItem(941, 940, "shared-a", "Trail", MediaReprocessItemStatus.Processing)));
            db.MediaReprocessJobs.Add(MakeJob(942, items: [MakeItem(944, 942, "shared-b", "Trail"), otherFailed]));
        }));

        // Act
        await repo.MarkSucceededAsync(
            941, "trails/shared.jpg", "trails/new.webp", 800, 600, 40_000, TestContext.Current.CancellationToken);

        // Assert
        var other = await repo.GetJobItemsAsync("job-942", TestContext.Current.CancellationToken);
        other.Value.Should().NotBeNull();
        other.Value.Should().ContainSingle(i => i.MediaIdentifier == "shared-b" && i.Status == MediaReprocessItemStatus.Succeeded);
        other.Value.Should().ContainSingle(i => i.MediaIdentifier == "shared-c" && i.Status == MediaReprocessItemStatus.Failed);
    }

    [Fact]
    public async Task MarkSucceededAsync_WhenTheImageRowIsGone_IsNotFound_AndLeavesTheItemProcessing()
    {
        // Arrange
        var factory = CreateSeededFactory(db =>
            db.MediaReprocessJobs.Add(MakeJob(950, items: MakeItem(951, 950, "deleted-image", "Trail", MediaReprocessItemStatus.Processing))));
        var repo = Build(factory);

        // Act
        var result = await repo.MarkSucceededAsync(
            951, "trails/gone.jpg", "trails/new.webp", 800, 600, 40_000, TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
        var items = await repo.GetJobItemsAsync("job-950", TestContext.Current.CancellationToken);
        items.Value.Should().NotBeNull();
        items.Value.Should().ContainSingle(i => i.Status == MediaReprocessItemStatus.Processing);
    }

    [Fact]
    public async Task MarkSucceededAsync_WhenAHikeImageStillUsesTheOldFile_SaysItIsStillReferenced()
    {
        // Arrange
        var job = MakeJob(910, items: MakeItem(911, 910, "trail-shared", "Trail", MediaReprocessItemStatus.Processing));
        var repo = Build(CreateSeededFactory(db =>
        {
            db.TrailImages.Add(MakeTrailImage(9101, "trail-shared", "trails/shared.jpg"));
            db.HikeImages.Add(new HikeImage { Id = 9102, Identifier = "hike-shared", HikeId = 1, ImageUrl = "trails/shared.jpg" });
            db.MediaReprocessJobs.Add(job);
        }));

        // Act
        var result = await repo.MarkSucceededAsync(
            911, "trails/shared.jpg", "trails/new.webp", 800, 600, 40_000, TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.OldFileStillReferenced.Should().BeTrue();
    }

    [Fact]
    public async Task RetryFailedItemsAsync_MovesOnlyFailedItemsBackToPending_AndReturnsTheirIds()
    {
        // Arrange
        var failed = MakeItem(921, 920, "media-1", "Trail", MediaReprocessItemStatus.Failed);
        failed.LastError = "Download: 404";
        var job = MakeJob(920,
            items:
            [
                failed,
                MakeItem(922, 920, "media-2", "Trail", MediaReprocessItemStatus.Succeeded),
                MakeItem(923, 920, "media-3", "Trail", MediaReprocessItemStatus.Cancelled),
            ]);
        var repo = Build(CreateSeededFactory(db => db.MediaReprocessJobs.Add(job)));

        // Act
        var result = await repo.RetryFailedItemsAsync("job-920", TestContext.Current.CancellationToken);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEquivalentTo([921]);

        var items = await repo.GetJobItemsAsync("job-920", TestContext.Current.CancellationToken);
        items.Value.Should().NotBeNull();
        items.Value.Should().ContainSingle(i => i.MediaIdentifier == "media-1" && i.Status == MediaReprocessItemStatus.Pending && i.LastError == null);
        items.Value.Should().ContainSingle(i => i.MediaIdentifier == "media-2" && i.Status == MediaReprocessItemStatus.Succeeded);
        items.Value.Should().ContainSingle(i => i.MediaIdentifier == "media-3" && i.Status == MediaReprocessItemStatus.Cancelled);
    }

    [Fact]
    public async Task RetryFailedItemsAsync_ForAnUnknownJob_IsNotFound()
    {
        // Arrange
        var repo = Build(CreateSeededFactory());

        // Act
        var result = await repo.RetryFailedItemsAsync("no-such-job", TestContext.Current.CancellationToken);

        // Assert
        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }
}
