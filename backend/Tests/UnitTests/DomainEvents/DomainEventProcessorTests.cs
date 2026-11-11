// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.DomainEvents;
using Core.Interfaces.Repositories;
using Core.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.DomainEvents;

public class DomainEventProcessorTests : TestBase
{
    private static DomainEventRecord MakePing(int id, int attempts = 0, string payload = "{\"id\":7}", string eventType = "test.ping")
    {
        return new()
        {
            Id = id,
            Identifier = $"event-{id}",
            EventType = eventType,
            Payload = payload,
            Status = DomainEventStatus.Pending,
            Attempts = attempts,
            NextAttemptAt = DateTime.UtcNow.AddMinutes(-1),
            CreatedAt = Utilities.SeedDates.Created,
            LastUpdatedAt = Utilities.SeedDates.Updated,
        };
    }

    private sealed record Harness(DomainEventProcessor Processor, IDbContextFactory<StigViddDbContext> Factory);

    private static Harness Build(
        IReadOnlyList<DomainEventRecord> seed,
        IReadOnlyList<ScriptedHandler> handlers,
        Dictionary<string, string?>? settings = null,
        Action<IServiceCollection>? configure = null)
    {
        var factory = CreateSeededFactory(db => db.DomainEvents.AddRange(seed));

        var services = new ServiceCollection();
        foreach (var handler in handlers)
            services.AddSingleton(typeof(IDomainEventHandler<TestPing>), handler);
        configure?.Invoke(services);

        var provider = services.BuildServiceProvider();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings ?? []).Build();

        var processor = new DomainEventProcessor(
            new DomainEventRepository(factory, NullLogger<DomainEventRepository>.Instance),
            DomainEventRegistry.FromTypes([typeof(TestPing)]),
            provider.GetRequiredService<IServiceScopeFactory>(),
            configuration,
            NullLogger<DomainEventProcessor>.Instance);

        return new Harness(processor, factory);
    }

    private static async Task<DomainEventRecord> ReadAsync(IDbContextFactory<StigViddDbContext> factory, int id)
    {
        await using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        return await db.DomainEvents.AsNoTracking().SingleAsync(e => e.Id == id, TestContext.Current.CancellationToken);
    }

    private static Task<int> ProcessAsync(Harness harness)
    {
        return harness.Processor.ProcessDueAsync(10, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task ProcessDueAsync_WhenTheHandlerSucceeds_MarksTheRowHandled()
    {
        var handler = new HandlerA();
        var harness = Build([MakePing(1)], [handler]);

        await ProcessAsync(harness);

        var row = await ReadAsync(harness.Factory, 1);
        row.Status.Should().Be(DomainEventStatus.Handled);
        row.SettledAt.Should().NotBeNull();
        row.CompletedHandlers.Should().Contain(typeof(HandlerA).FullName);
        handler.Calls.Should().Be(1);
    }

    [Fact]
    public async Task ProcessDueAsync_DeliversThePayloadToTheHandler()
    {
        var handler = new HandlerA();
        var harness = Build([MakePing(1, payload: "{\"id\":7}")], [handler]);

        await ProcessAsync(harness);

        handler.Seen.Should().Equal(new TestPing(7));
    }

    [Fact]
    public async Task ProcessDueAsync_WhenTheHandlerReturnsFail_RetriesWithBackoff()
    {
        var handler = new HandlerA { Behaviour = (_, _) => Task.FromResult(Result.Fail(new Message(500, "nope"))) };
        var harness = Build([MakePing(1)], [handler]);

        await ProcessAsync(harness);

        var row = await ReadAsync(harness.Factory, 1);
        row.Status.Should().Be(DomainEventStatus.Pending);
        row.Attempts.Should().Be(1);
        row.NextAttemptAt.Should().BeCloseTo(DateTime.UtcNow.AddMinutes(1), TimeSpan.FromSeconds(30));
        row.LastError.Should().Contain("nope");
    }

    [Fact]
    public async Task ProcessDueAsync_WhenTheHandlerThrows_RetriesAndScrubsEmailAddresses()
    {
        var handler = new HandlerA { Behaviour = (_, _) => throw new InvalidOperationException("could not mail natur@example.com") };
        var harness = Build([MakePing(1)], [handler]);

        await ProcessAsync(harness);

        var row = await ReadAsync(harness.Factory, 1);
        row.Status.Should().Be(DomainEventStatus.Pending);
        row.Attempts.Should().Be(1);
        row.LastError.Should().StartWith($"{typeof(HandlerA).FullName}: InvalidOperationException:");
        row.LastError.Should().Contain("***@example.com");
        row.LastError.Should().NotContain("natur@example.com");
    }

    [Fact]
    public async Task ProcessDueAsync_OnTheFifthFailure_ParksTheRowAsFailed()
    {
        var handler = new HandlerA { Behaviour = (_, _) => Task.FromResult(Result.Fail(new Message(500, "nope"))) };
        var harness = Build([MakePing(1, attempts: 4)], [handler]);

        await ProcessAsync(harness);

        var row = await ReadAsync(harness.Factory, 1);
        row.Status.Should().Be(DomainEventStatus.Failed);
        row.SettledAt.Should().NotBeNull();
    }

    [Fact]
    public async Task ProcessDueAsync_WhenAHandlerNeverFinishes_TimesOutAndRetries()
    {
        var handler = new HandlerA
        {
            Behaviour = async (_, ctoken) =>
            {
                await Task.Delay(Timeout.Infinite, ctoken);
                return Result.Ok();
            },
        };
        var harness = Build([MakePing(1)], [handler], new() { ["DomainEvents:HandlerTimeoutSeconds"] = "1" });

        await ProcessAsync(harness);

        var row = await ReadAsync(harness.Factory, 1);
        row.Status.Should().Be(DomainEventStatus.Pending);
        row.Attempts.Should().Be(1);
        row.LastError.Should().Contain("did not finish");
    }

    [Fact]
    public async Task ProcessDueAsync_WhenOneHandlerTimesOut_KeepsTheOneThatSucceededAndDoesNotRerunIt()
    {
        var quick = new HandlerA();
        var slow = new HandlerB
        {
            Behaviour = async (_, ctoken) =>
            {
                await Task.Delay(Timeout.Infinite, ctoken);
                return Result.Ok();
            },
        };
        var harness = Build([MakePing(1)], [quick, slow], new() { ["DomainEvents:HandlerTimeoutSeconds"] = "1" });

        await ProcessAsync(harness);

        var row = await ReadAsync(harness.Factory, 1);
        row.Status.Should().Be(DomainEventStatus.Pending);
        row.CompletedHandlers.Should().Contain(typeof(HandlerA).FullName);
        row.CompletedHandlers.Should().NotContain(typeof(HandlerB).FullName);

        await using (var db = await harness.Factory.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            var again = await db.DomainEvents.SingleAsync(TestContext.Current.CancellationToken);
            again.NextAttemptAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        slow.Behaviour = (_, _) => Task.FromResult(Result.Ok());

        await ProcessAsync(harness);

        quick.Calls.Should().Be(1);
        (await ReadAsync(harness.Factory, 1)).Status.Should().Be(DomainEventStatus.Handled);
    }

    [Fact]
    public async Task ProcessDueAsync_WhenOneRowThrowsUnexpectedly_StillProcessesTheRestOfTheBatch()
    {
        var calls = 0;
        var handler = new HandlerA();
        var harness = Build(
            [MakePing(1), MakePing(2)],
            [],
            configure: services => services.AddTransient<IDomainEventHandler<TestPing>>(_ =>
                ++calls == 1 ? throw new InvalidOperationException("ctor failed for natur@example.com") : handler));

        await ProcessAsync(harness);

        var first = await ReadAsync(harness.Factory, 1);
        first.Status.Should().Be(DomainEventStatus.Pending);
        first.Attempts.Should().Be(1);
        first.LastError.Should().StartWith("InvalidOperationException:");
        first.LastError.Should().NotContain("natur@example.com");
        (await ReadAsync(harness.Factory, 2)).Status.Should().Be(DomainEventStatus.Handled);
    }

    private sealed class ThrowsOnDispose : ScriptedHandler, IDisposable
    {
        public void Dispose()
        {
            throw new InvalidOperationException("dispose failed");
        }
    }

    [Fact]
    public async Task ProcessDueAsync_WhenAHandlerIgnoresItsTokenAndNeverReturns_AbandonsItAndRetries()
    {
        var handler = new HandlerA
        {
            Behaviour = async (_, _) =>
            {
                await Task.Delay(Timeout.Infinite);
                return Result.Ok();
            },
        };
        var harness = Build([MakePing(1)], [handler], new() { ["DomainEvents:HandlerTimeoutSeconds"] = "1" });

        var pass = ProcessAsync(harness);

        (await Task.WhenAny(pass, Task.Delay(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken))).Should().Be(pass);
        var row = await ReadAsync(harness.Factory, 1);
        row.Status.Should().Be(DomainEventStatus.Pending);
        row.Attempts.Should().Be(1);
        row.LastError.Should().Contain("did not finish");
    }

    [Fact]
    public async Task ProcessDueAsync_WhenAHandlerThrowsOnDispose_StillMarksTheEventHandled()
    {
        var harness = Build([MakePing(1)], [], configure: services =>
            services.AddTransient<IDomainEventHandler<TestPing>>(_ => new ThrowsOnDispose()));

        await ProcessAsync(harness);

        (await ReadAsync(harness.Factory, 1)).Status.Should().Be(DomainEventStatus.Handled);
    }

    [Fact]
    public async Task ProcessDueAsync_WhenTheHostStopsMidHandler_RecordsNothingForTheRow()
    {
        var handler = new HandlerA
        {
            Behaviour = async (_, ctoken) =>
            {
                await Task.Delay(Timeout.Infinite, ctoken);
                return Result.Ok();
            },
        };
        var repository = new Mock<IDomainEventRepository>();
        repository.Setup(r => r.ClaimDueAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<DomainEventBatch>.Success(new DomainEventBatch([MakePing(1)], 1)));
        var processor = new DomainEventProcessor(
            repository.Object,
            DomainEventRegistry.FromTypes([typeof(TestPing)]),
            new ServiceCollection().AddSingleton<IDomainEventHandler<TestPing>>(handler).BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
            new ConfigurationBuilder().Build(),
            NullLogger<DomainEventProcessor>.Instance);
        using var stopping = new CancellationTokenSource(TimeSpan.FromMilliseconds(200));

        var act = () => processor.ProcessDueAsync(10, stopping.Token);

        await act.Should().ThrowAsync<OperationCanceledException>();
        repository.Verify(r => r.MarkFailedAsync(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<IReadOnlyList<string>>(), It.IsAny<bool>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        repository.Verify(r => r.MarkHandledAsync(It.IsAny<int>(), It.IsAny<IReadOnlyList<string>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessDueAsync_WhenTheHostStopsBetweenRows_DoesNotStartTheNextRowsHandler()
    {
        using var stopping = new CancellationTokenSource();
        var handler = new HandlerA();
        var repository = new Mock<IDomainEventRepository>();
        repository.Setup(r => r.ClaimDueAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<DomainEventBatch>.Success(new DomainEventBatch([MakePing(1), MakePing(2)], 2)));
        repository.Setup(r => r.MarkHandledAsync(It.IsAny<int>(), It.IsAny<IReadOnlyList<string>>(), It.IsAny<CancellationToken>()))
            .Returns(async () =>
            {
                await stopping.CancelAsync();
                return RepositoryResult.Success();
            });
        var processor = new DomainEventProcessor(
            repository.Object,
            DomainEventRegistry.FromTypes([typeof(TestPing)]),
            new ServiceCollection().AddSingleton<IDomainEventHandler<TestPing>>(handler).BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
            new ConfigurationBuilder().Build(),
            NullLogger<DomainEventProcessor>.Instance);

        var act = () => processor.ProcessDueAsync(10, stopping.Token);

        await act.Should().ThrowAsync<OperationCanceledException>();
        handler.Calls.Should().Be(1);
    }

    [Fact]
    public async Task ProcessDueAsync_WhenTheHostIsStopping_RethrowsAndLeavesTheRowProcessing()
    {
        var handler = new HandlerA
        {
            Behaviour = async (_, ctoken) =>
            {
                await Task.Delay(Timeout.Infinite, ctoken);
                return Result.Ok();
            },
        };
        var harness = Build([MakePing(1)], [handler]);
        using var stopping = new CancellationTokenSource(TimeSpan.FromMilliseconds(200));

        var act = () => harness.Processor.ProcessDueAsync(10, stopping.Token);

        await act.Should().ThrowAsync<OperationCanceledException>();
        (await ReadAsync(harness.Factory, 1)).Status.Should().Be(DomainEventStatus.Processing);
    }

    [Fact]
    public async Task ProcessDueAsync_WhenTheEventTypeIsUnknown_ParksItOnTheFirstPass()
    {
        var harness = Build([MakePing(1, eventType: "no.such.event")], [new HandlerA()]);

        await ProcessAsync(harness);

        var row = await ReadAsync(harness.Factory, 1);
        row.Status.Should().Be(DomainEventStatus.Failed);
        row.Attempts.Should().Be(1);
        row.LastError.Should().Contain("no.such.event");
    }

    [Fact]
    public async Task ProcessDueAsync_WhenThePayloadCannotBeRead_ParksItOnTheFirstPass()
    {
        var handler = new HandlerA();
        var harness = Build([MakePing(1, payload: "not json")], [handler]);

        await ProcessAsync(harness);

        (await ReadAsync(harness.Factory, 1)).Status.Should().Be(DomainEventStatus.Failed);
        handler.Calls.Should().Be(0);
    }

    [Fact]
    public async Task ProcessDueAsync_WhenTheFirstHandlerFails_StillRunsTheSecondAndRemembersIt()
    {
        var failing = new HandlerA { Behaviour = (_, _) => Task.FromResult(Result.Fail(new Message(500, "nope"))) };
        var other = new HandlerB();
        var harness = Build([MakePing(1)], [failing, other]);

        await ProcessAsync(harness);

        other.Calls.Should().Be(1);
        var row = await ReadAsync(harness.Factory, 1);
        row.Status.Should().Be(DomainEventStatus.Pending);
        row.CompletedHandlers.Should().Contain(typeof(HandlerB).FullName);
        row.CompletedHandlers.Should().NotContain(typeof(HandlerA).FullName);
    }

    [Fact]
    public async Task ProcessDueAsync_OnRetry_DoesNotRunAHandlerThatAlreadySucceeded()
    {
        var flaky = new HandlerA { Behaviour = (_, _) => Task.FromResult(Result.Fail(new Message(500, "nope"))) };
        var steady = new HandlerB();
        var harness = Build([MakePing(1)], [flaky, steady]);
        await ProcessAsync(harness);

        await using (var db = await harness.Factory.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            var row = await db.DomainEvents.SingleAsync(TestContext.Current.CancellationToken);
            row.NextAttemptAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
        flaky.Behaviour = (_, _) => Task.FromResult(Result.Ok());

        await ProcessAsync(harness);

        flaky.Calls.Should().Be(2);
        steady.Calls.Should().Be(1);
        (await ReadAsync(harness.Factory, 1)).Status.Should().Be(DomainEventStatus.Handled);
    }

    [Fact]
    public async Task ProcessDueAsync_WithNoHandlers_MarksTheEventHandledAsHistoryOnly()
    {
        var harness = Build([MakePing(1)], []);

        await ProcessAsync(harness);

        (await ReadAsync(harness.Factory, 1)).Status.Should().Be(DomainEventStatus.Handled);
    }

    [Fact]
    public async Task ProcessDueAsync_ReturnsTheDueCountEvenWhenEveryClaimWasLost()
    {
        var repository = new Mock<IDomainEventRepository>();
        repository.Setup(r => r.ClaimDueAsync(3, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<DomainEventBatch>.Success(new DomainEventBatch([], 3)));
        var processor = new DomainEventProcessor(
            repository.Object,
            DomainEventRegistry.FromTypes([typeof(TestPing)]),
            new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
            new ConfigurationBuilder().Build(),
            NullLogger<DomainEventProcessor>.Instance);

        var due = await processor.ProcessDueAsync(3, TestContext.Current.CancellationToken);

        due.Should().Be(3);
    }

    [Fact]
    public async Task ProcessDueAsync_WhenTheClaimFails_ReturnsZero()
    {
        var repository = new Mock<IDomainEventRepository>();
        repository.Setup(r => r.ClaimDueAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<DomainEventBatch>.Error());
        var processor = new DomainEventProcessor(
            repository.Object,
            DomainEventRegistry.FromTypes([typeof(TestPing)]),
            new ServiceCollection().BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
            new ConfigurationBuilder().Build(),
            NullLogger<DomainEventProcessor>.Instance);

        (await processor.ProcessDueAsync(3, TestContext.Current.CancellationToken)).Should().Be(0);
    }

    [Fact]
    public async Task ProcessDueAsync_ReturnsHowManyRowsWereDue()
    {
        var harness = Build([MakePing(1), MakePing(2), MakePing(3)], [new HandlerA()]);

        var due = await harness.Processor.ProcessDueAsync(2, TestContext.Current.CancellationToken);

        due.Should().Be(2);
        (await ReadAsync(harness.Factory, 3)).Status.Should().Be(DomainEventStatus.Pending);
    }
}
