// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.RepositoryTests;

public class DomainEventRepositoryTests : TestBase
{
    private static DomainEventRepository Build(IDbContextFactory<StigViddDbContext> factory) =>
        new(factory, NullLogger<DomainEventRepository>.Instance);

    private static DomainEventRecord MakeRecord(
        int id,
        DomainEventStatus status = DomainEventStatus.Pending,
        DateTime? nextAttemptAt = null,
        int attempts = 0,
        DateTime? settledAt = null,
        string? completedHandlers = null) =>
        new()
        {
            Id = id,
            Identifier = $"event-{id}",
            EventType = "test.ping",
            Payload = "{\"id\":1}",
            Status = status,
            Attempts = attempts,
            NextAttemptAt = nextAttemptAt ?? DateTime.UtcNow.AddMinutes(-1),
            SettledAt = settledAt,
            CompletedHandlers = completedHandlers,
            CreatedAt = Utilities.SeedDates.Created,
            LastUpdatedAt = Utilities.SeedDates.Updated,
        };

    private static Action<StigViddDbContext> Seed(params DomainEventRecord[] records) =>
        db => db.DomainEvents.AddRange(records);

    private static T Ok<T>(RepositoryResult<T> result)
    {
        result.Status.Should().Be(RepositoryResultStatus.Success);
        return result.Value ?? throw new InvalidOperationException("expected a value");
    }

    private static async Task<DomainEventRecord> ReadAsync(IDbContextFactory<StigViddDbContext> factory, int id)
    {
        await using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        return await db.DomainEvents.AsNoTracking().SingleAsync(e => e.Id == id, TestContext.Current.CancellationToken);
    }

    private sealed class FlipOnSave(Func<Task> flip) : SaveChangesInterceptor
    {
        public bool Armed { get; set; }

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Armed)
            {
                Armed = false;
                await flip();
            }

            return result;
        }
    }

    private static (DomainEventRepository Repository, FlipOnSave Interceptor, IDbContextFactory<StigViddDbContext> Reader) BuildRacy(
        DomainEventRecord record, DomainEventStatus rivalStatus)
    {
        var name = Guid.NewGuid().ToString();

        var plain = new DbContextOptionsBuilder<StigViddDbContext>().UseInMemoryDatabase(name).Options;

        using (var seed = new StigViddDbContext(plain))
        {
            seed.Database.EnsureCreated();
            seed.DomainEvents.Add(record);
            seed.SaveChanges();
        }

        var interceptor = new FlipOnSave(async () =>
        {
            await using var rival = new StigViddDbContext(plain);
            var row = await rival.DomainEvents.SingleAsync(e => e.Id == record.Id);
            row.Status = rivalStatus;
            await rival.SaveChangesAsync();
        });

        var intercepted = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(name)
            .AddInterceptors(interceptor)
            .Options;

        var writer = new Mock<IDbContextFactory<StigViddDbContext>>();
        writer.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(intercepted));

        var reader = new Mock<IDbContextFactory<StigViddDbContext>>();
        reader.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(plain));

        return (Build(writer.Object), interceptor, reader.Object);
    }

    [Fact]
    public async Task AddAsync_StoresTheRecord()
    {
        var factory = CreateSeededFactory();

        var result = await Build(factory).AddAsync(MakeRecord(1), TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        (await ReadAsync(factory, 1)).EventType.Should().Be("test.ping");
    }

    [Fact]
    public async Task ClaimDueAsync_TakesOnlyDueRowsOldestFirst()
    {
        var factory = CreateSeededFactory(Seed(
            MakeRecord(3),
            MakeRecord(1),
            MakeRecord(2, DomainEventStatus.Handled),
            MakeRecord(4, nextAttemptAt: DateTime.UtcNow.AddHours(1))));

        var batch = Ok(await Build(factory).ClaimDueAsync(10, TestContext.Current.CancellationToken));

        batch.Claimed.Select(e => e.Id).Should().Equal(1, 3);
        batch.DueCount.Should().Be(2);
        (await ReadAsync(factory, 1)).Status.Should().Be(DomainEventStatus.Processing);
        (await ReadAsync(factory, 3)).Status.Should().Be(DomainEventStatus.Processing);
        (await ReadAsync(factory, 2)).Status.Should().Be(DomainEventStatus.Handled);
        (await ReadAsync(factory, 4)).Status.Should().Be(DomainEventStatus.Pending);
    }

    [Fact]
    public async Task ClaimDueAsync_DoesNotClaimARowWhoseNextAttemptIsInTheFuture()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, nextAttemptAt: DateTime.UtcNow.AddMinutes(5), attempts: 2)));

        var batch = Ok(await Build(factory).ClaimDueAsync(10, TestContext.Current.CancellationToken));

        batch.Claimed.Should().BeEmpty();
        var row = await ReadAsync(factory, 1);
        row.Status.Should().Be(DomainEventStatus.Pending);
        row.Attempts.Should().Be(2);
    }

    [Fact]
    public async Task ClaimDueAsync_RespectsTheBatchSize()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1), MakeRecord(2), MakeRecord(3)));

        var batch = Ok(await Build(factory).ClaimDueAsync(2, TestContext.Current.CancellationToken));

        batch.Claimed.Select(e => e.Id).Should().Equal(1, 2);
        batch.DueCount.Should().Be(2);
        (await ReadAsync(factory, 3)).Status.Should().Be(DomainEventStatus.Pending);
    }

    [Fact]
    public async Task Status_IsAConcurrencyToken_SoAStaleWriterFailsToSave()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1)));
        await using var first = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        await using var second = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stale = await first.DomainEvents.SingleAsync(TestContext.Current.CancellationToken);
        var winner = await second.DomainEvents.SingleAsync(TestContext.Current.CancellationToken);

        winner.Status = DomainEventStatus.Processing;
        await second.SaveChangesAsync(TestContext.Current.CancellationToken);
        stale.Status = DomainEventStatus.Processing;

        var save = () => first.SaveChangesAsync(TestContext.Current.CancellationToken);

        await save.Should().ThrowAsync<DbUpdateConcurrencyException>();
    }

    [Fact]
    public async Task ClaimDueAsync_WhenTheRowMovesUnderIt_SkipsItWithoutFailing()
    {
        var (repository, interceptor, reader) = BuildRacy(MakeRecord(1), DomainEventStatus.Cancelled);
        interceptor.Armed = true;

        var batch = Ok(await repository.ClaimDueAsync(10, TestContext.Current.CancellationToken));

        batch.Claimed.Should().BeEmpty();
        batch.DueCount.Should().Be(1);
        (await ReadAsync(reader, 1)).Status.Should().Be(DomainEventStatus.Cancelled);
    }

    [Fact]
    public async Task MarkHandledAsync_WhenTheRowMovesUnderIt_ReturnsConflict()
    {
        var (repository, interceptor, reader) = BuildRacy(MakeRecord(1, DomainEventStatus.Processing), DomainEventStatus.Cancelled);
        interceptor.Armed = true;

        var result = await repository.MarkHandledAsync(1, ["A"], TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
        (await ReadAsync(reader, 1)).Status.Should().Be(DomainEventStatus.Cancelled);
    }

    [Fact]
    public async Task MarkFailedAsync_WhenTheRowMovesUnderIt_ReturnsConflict()
    {
        var (repository, interceptor, _) = BuildRacy(MakeRecord(1, DomainEventStatus.Processing), DomainEventStatus.Cancelled);
        interceptor.Armed = true;

        var result = await repository.MarkFailedAsync(1, "boom", [], permanent: false, 5, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Theory]
    [InlineData(DomainEventStatus.Cancelled)]
    [InlineData(DomainEventStatus.Pending)]
    [InlineData(DomainEventStatus.Handled)]
    public async Task MarkHandledAsync_WhenTheRowIsNoLongerProcessing_ReturnsConflictAndLeavesItAlone(DomainEventStatus current)
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, current)));

        var result = await Build(factory).MarkHandledAsync(1, ["A"], TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
        (await ReadAsync(factory, 1)).Status.Should().Be(current);
    }

    [Theory]
    [InlineData(DomainEventStatus.Cancelled)]
    [InlineData(DomainEventStatus.Pending)]
    public async Task MarkFailedAsync_WhenTheRowIsNoLongerProcessing_ReturnsConflictAndLeavesItAlone(DomainEventStatus current)
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, current)));

        var result = await Build(factory).MarkFailedAsync(1, "boom", [], permanent: false, 5, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
        var row = await ReadAsync(factory, 1);
        row.Status.Should().Be(current);
        row.Attempts.Should().Be(0);
    }

    [Fact]
    public async Task MarkHandledAsync_ForAMissingRow_ReturnsNotFound()
    {
        var factory = CreateSeededFactory();

        var result = await Build(factory).MarkHandledAsync(99, [], TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task MarkFailedAsync_ForAMissingRow_ReturnsNotFound()
    {
        var factory = CreateSeededFactory();

        var result = await Build(factory).MarkFailedAsync(99, "boom", [], permanent: false, 5, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task ClaimDueAsync_WhenTheHostIsStopping_ThrowsInsteadOfLoggingAnError()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1)));
        using var stopping = new CancellationTokenSource();
        await stopping.CancelAsync();

        var claim = () => Build(factory).ClaimDueAsync(10, stopping.Token);

        await claim.Should().ThrowAsync<OperationCanceledException>();
    }

    [Fact]
    public async Task MarkHandledAsync_WhenTheHostIsStopping_Throws()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, DomainEventStatus.Processing)));
        using var stopping = new CancellationTokenSource();
        await stopping.CancelAsync();

        var mark = () => Build(factory).MarkHandledAsync(1, [], stopping.Token);

        await mark.Should().ThrowAsync<OperationCanceledException>();
    }

    [Fact]
    public async Task ResetInterruptedAsync_MovesProcessingBackToPendingAndLeavesEverythingElse()
    {
        var factory = CreateSeededFactory(Seed(
            MakeRecord(1, DomainEventStatus.Processing),
            MakeRecord(2, DomainEventStatus.Handled),
            MakeRecord(3, DomainEventStatus.Failed),
            MakeRecord(4, DomainEventStatus.Pending, nextAttemptAt: DateTime.UtcNow.AddHours(1))));

        var reset = Ok(await Build(factory).ResetInterruptedAsync(5, TestContext.Current.CancellationToken));

        reset.Should().Be(1);
        (await ReadAsync(factory, 1)).Status.Should().Be(DomainEventStatus.Pending);
        (await ReadAsync(factory, 2)).Status.Should().Be(DomainEventStatus.Handled);
        (await ReadAsync(factory, 3)).Status.Should().Be(DomainEventStatus.Failed);
        (await ReadAsync(factory, 4)).Status.Should().Be(DomainEventStatus.Pending);
    }

    [Fact]
    public async Task ResetInterruptedAsync_CountsTheInterruptionAsAnAttempt()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, DomainEventStatus.Processing, attempts: 1)));

        await Build(factory).ResetInterruptedAsync(5, TestContext.Current.CancellationToken);

        var row = await ReadAsync(factory, 1);
        row.Attempts.Should().Be(2);
        row.Status.Should().Be(DomainEventStatus.Pending);
        row.SettledAt.Should().BeNull();
    }

    [Fact]
    public async Task ResetInterruptedAsync_ParksARowThatHasBeenInterruptedMaxAttemptsTimes()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, DomainEventStatus.Processing, attempts: 4)));

        await Build(factory).ResetInterruptedAsync(5, TestContext.Current.CancellationToken);

        var row = await ReadAsync(factory, 1);
        row.Status.Should().Be(DomainEventStatus.Failed);
        row.SettledAt.Should().NotBeNull();
        row.LastError.Should().Contain("Interrupted");
    }

    private sealed class ThrowOnNthSave(int nth) : SaveChangesInterceptor
    {
        private int _saves;

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Interlocked.Increment(ref _saves) == nth)
                throw new InvalidOperationException("connection dropped");

            return ValueTask.FromResult(result);
        }
    }

    private static IDbContextFactory<StigViddDbContext> FactoryThatFailsOnSave(int nth, params DomainEventRecord[] records)
    {
        var name = Guid.NewGuid().ToString();
        var plain = new DbContextOptionsBuilder<StigViddDbContext>().UseInMemoryDatabase(name).Options;

        using (var seed = new StigViddDbContext(plain))
        {
            seed.Database.EnsureCreated();
            seed.DomainEvents.AddRange(records);
            seed.SaveChanges();
        }

        var failing = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseInMemoryDatabase(name)
            .AddInterceptors(new ThrowOnNthSave(nth))
            .Options;

        var factory = new Mock<IDbContextFactory<StigViddDbContext>>();
        factory.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new StigViddDbContext(failing));
        factory.Setup(f => f.CreateDbContext()).Returns(() => new StigViddDbContext(plain));

        return factory.Object;
    }

    [Fact]
    public async Task ClaimDueAsync_WhenALaterRowFailsToSave_ReturnsTheRowsAlreadyClaimed()
    {
        var factory = FactoryThatFailsOnSave(2, MakeRecord(1), MakeRecord(2), MakeRecord(3));

        var batch = Ok(await Build(factory).ClaimDueAsync(10, TestContext.Current.CancellationToken));

        batch.Claimed.Select(e => e.Id).Should().Equal(1);
        batch.DueCount.Should().Be(3);
    }

    [Fact]
    public async Task ClaimDueAsync_WhenTheFirstRowFailsToSave_ReturnsErrorSoTheDrainDoesNotSpin()
    {
        var factory = FactoryThatFailsOnSave(1, MakeRecord(1), MakeRecord(2));

        var result = await Build(factory).ClaimDueAsync(10, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Error);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(1, 2)]
    [InlineData(2, 4)]
    [InlineData(3, 8)]
    [InlineData(4, 16)]
    [InlineData(9, 16)]
    [InlineData(33, 16)]
    [InlineData(34, 16)]
    [InlineData(2000, 16)]
    public async Task MarkFailedAsync_BacksOff_1_2_4_8_16_AndCaps(int attemptsBefore, int expectedMinutes)
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, DomainEventStatus.Processing, attempts: attemptsBefore)));

        var failed = Ok(await Build(factory).MarkFailedAsync(1, "boom", [], permanent: false, int.MaxValue, TestContext.Current.CancellationToken));

        failed.Status.Should().Be(DomainEventStatus.Pending);
        failed.Attempts.Should().Be(attemptsBefore + 1);
        failed.NextAttemptAt.Should().BeCloseTo(DateTime.UtcNow.AddMinutes(expectedMinutes), TimeSpan.FromSeconds(30));
    }

    [Fact]
    public async Task MarkFailedAsync_AtTheCap_ParksAndStampsSettledAt()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, DomainEventStatus.Processing, attempts: 4)));

        var failed = Ok(await Build(factory).MarkFailedAsync(1, "boom", [], permanent: false, 5, TestContext.Current.CancellationToken));

        failed.Status.Should().Be(DomainEventStatus.Failed);
        failed.SettledAt.Should().NotBeNull();
        (await ReadAsync(factory, 1)).LastError.Should().Be("boom");
    }

    [Fact]
    public async Task MarkFailedAsync_UnderTheCap_DoesNotStampSettledAt()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, DomainEventStatus.Processing, attempts: 1)));

        var failed = Ok(await Build(factory).MarkFailedAsync(1, "boom", [], permanent: false, 5, TestContext.Current.CancellationToken));

        failed.Status.Should().Be(DomainEventStatus.Pending);
        failed.SettledAt.Should().BeNull();
    }

    [Fact]
    public async Task MarkFailedAsync_Permanent_ParksOnTheFirstAttempt()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, DomainEventStatus.Processing)));

        var failed = Ok(await Build(factory).MarkFailedAsync(1, "unknown type", [], permanent: true, 5, TestContext.Current.CancellationToken));

        failed.Status.Should().Be(DomainEventStatus.Failed);
        failed.Attempts.Should().Be(1);
        failed.SettledAt.Should().NotBeNull();
    }

    [Fact]
    public async Task MarkFailedAsync_KeepsTheHandlersThatAlreadySucceeded()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, DomainEventStatus.Processing)));

        await Build(factory).MarkFailedAsync(1, "boom", ["Handler.A"], permanent: false, 5, TestContext.Current.CancellationToken);

        (await ReadAsync(factory, 1)).CompletedHandlers.Should().Be("[\"Handler.A\"]");
    }

    [Fact]
    public async Task MarkFailedAsync_TruncatesAnOverlongError()
    {
        var factory = CreateSeededFactory(Seed(MakeRecord(1, DomainEventStatus.Processing)));

        await Build(factory).MarkFailedAsync(1, new string('x', 5000), [], permanent: false, 5, TestContext.Current.CancellationToken);

        (await ReadAsync(factory, 1)).LastError.Should().HaveLength(2000);
    }

    [Fact]
    public async Task MarkHandledAsync_StampsSettledAtAndClearsLastError()
    {
        var earlier = MakeRecord(1, DomainEventStatus.Processing);
        earlier.LastError = "earlier failure";
        var factory = CreateSeededFactory(Seed(earlier));

        var result = await Build(factory).MarkHandledAsync(1, ["Handler.A"], TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        var row = await ReadAsync(factory, 1);
        row.Status.Should().Be(DomainEventStatus.Handled);
        row.SettledAt.Should().NotBeNull();
        row.LastError.Should().BeNull();
        row.CompletedHandlers.Should().Be("[\"Handler.A\"]");
    }

    [Fact]
    public void PurgeableSettled_MatchesOnlyTerminalRowsSettledBeforeTheCutoff()
    {
        var cutoff = new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        var before = cutoff.AddDays(-1);
        var after = cutoff.AddDays(1);

        var rows = new[]
        {
            MakeRecord(1, DomainEventStatus.Handled, settledAt: before),
            MakeRecord(2, DomainEventStatus.Failed, settledAt: before),
            MakeRecord(3, DomainEventStatus.Cancelled, settledAt: before),
            MakeRecord(4, DomainEventStatus.Handled, settledAt: after),
            MakeRecord(5, DomainEventStatus.Handled, settledAt: null),
            MakeRecord(6, DomainEventStatus.Pending, settledAt: before),
            MakeRecord(7, DomainEventStatus.Processing, settledAt: before),
        };

        var matched = rows.AsQueryable().Where(DomainEventRepository.PurgeableSettled(cutoff)).Select(e => e.Id);

        matched.Should().Equal(1, 2, 3);
    }
}
