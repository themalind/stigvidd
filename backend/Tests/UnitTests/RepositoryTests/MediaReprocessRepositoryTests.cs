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
        await repo.MarkSucceededAsync(1, "trails/new.jpg", 400, 300, 12345, TestContext.Current.CancellationToken);

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
}
