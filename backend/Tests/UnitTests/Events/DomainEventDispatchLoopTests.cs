// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Events;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.Events;

public class DomainEventDispatchLoopTests
{
    private static async Task<bool> CompletesQuicklyAsync(Task task)
    {
        var winner = await Task.WhenAny(task, Task.Delay(TimeSpan.FromSeconds(5), TestContext.Current.CancellationToken));
        return winner == task;
    }

    private sealed record Rig(
        DomainEventDispatchLoop Loop,
        IDomainEventSignal Signal,
        Mock<IDomainEventProcessor> Processor,
        Mock<IDomainEventRepository> Repository,
        Mock<IMaintenanceGate> Gate);

    private static Rig Build(Dictionary<string, string?> settings, IDomainEventSignal? signal = null)
    {
        var processor = new Mock<IDomainEventProcessor>();
        var repository = new Mock<IDomainEventRepository>();
        var gate = new Mock<IMaintenanceGate>();
        gate.Setup(g => g.WaitWhilePausedAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var services = new ServiceCollection();
        services.AddSingleton(processor.Object);
        services.AddSingleton(repository.Object);
        var provider = services.BuildServiceProvider();

        var effective = signal ?? new DomainEventSignal();

        var loop = new DomainEventDispatchLoop(
            effective,
            gate.Object,
            provider.GetRequiredService<IServiceScopeFactory>(),
            new ConfigurationBuilder().AddInMemoryCollection(settings).Build(),
            NullLogger<DomainEventDispatchLoop>.Instance);

        return new Rig(loop, effective, processor, repository, gate);
    }

    [Fact]
    public async Task RunOnceAsync_KeepsDrainingWhileAFullBatchComesBack()
    {
        var rig = Build(new() { ["DomainEvents:BatchSize"] = "2" });
        rig.Processor.SetupSequence(p => p.ProcessDueAsync(2, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2).ReturnsAsync(2).ReturnsAsync(1);
        rig.Signal.Poke();

        await rig.Loop.RunOnceAsync(TestContext.Current.CancellationToken);

        rig.Processor.Verify(p => p.ProcessDueAsync(2, It.IsAny<CancellationToken>()), Times.Exactly(3));
    }

    [Fact]
    public async Task RunOnceAsync_WokenByAPoke_DoesNotWaitOutThePollInterval()
    {
        var rig = Build(new() { ["DomainEvents:PollIntervalSeconds"] = "30" });
        rig.Processor.Setup(p => p.ProcessDueAsync(It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync(0);
        rig.Signal.Poke();

        var pass = rig.Loop.RunOnceAsync(TestContext.Current.CancellationToken);

        (await CompletesQuicklyAsync(pass)).Should().BeTrue();
        rig.Processor.Verify(p => p.ProcessDueAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RunOnceAsync_WithNoPoke_RunsWhenTheTickFires()
    {
        var rig = Build(new() { ["DomainEvents:PollIntervalSeconds"] = "1" });
        rig.Processor.Setup(p => p.ProcessDueAsync(It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync(0);

        var pass = rig.Loop.RunOnceAsync(TestContext.Current.CancellationToken);

        (await CompletesQuicklyAsync(pass)).Should().BeTrue();
        rig.Processor.Verify(p => p.ProcessDueAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RunOnceAsync_WhileMaintenanceIsPaused_HoldsTheProcessorBack()
    {
        var rig = Build([]);
        var release = new TaskCompletionSource();
        rig.Gate.Setup(g => g.WaitWhilePausedAsync(It.IsAny<CancellationToken>())).Returns(release.Task);
        rig.Processor.Setup(p => p.ProcessDueAsync(It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync(0);
        rig.Signal.Poke();

        var pass = rig.Loop.RunOnceAsync(TestContext.Current.CancellationToken);
        await Task.Delay(200, TestContext.Current.CancellationToken);

        pass.IsCompleted.Should().BeFalse();
        rig.Processor.Verify(p => p.ProcessDueAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);

        release.SetResult();
        (await CompletesQuicklyAsync(pass)).Should().BeTrue();
        rig.Processor.Verify(p => p.ProcessDueAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RecoverAsync_ResetsInterruptedEventsAndPokes()
    {
        var signal = new RecordingSignal();
        var rig = Build([], signal);
        rig.Repository.Setup(r => r.ResetInterruptedAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(2));

        await rig.Loop.RecoverAsync(TestContext.Current.CancellationToken);

        rig.Repository.Verify(r => r.ResetInterruptedAsync(5, It.IsAny<CancellationToken>()), Times.Once);
        signal.Pokes.Should().Be(1);
    }

    [Fact]
    public async Task RecoverAsync_PassesTheConfiguredMaxAttemptsToTheReset()
    {
        var rig = Build(new() { ["DomainEvents:MaxAttempts"] = "9" });
        rig.Repository.Setup(r => r.ResetInterruptedAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(0));

        await rig.Loop.RecoverAsync(TestContext.Current.CancellationToken);

        rig.Repository.Verify(r => r.ResetInterruptedAsync(9, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RunOnceAsync_AfterAFailedRecovery_RetriesTheResetBeforeProcessing()
    {
        var rig = Build([]);
        rig.Repository.SetupSequence(r => r.ResetInterruptedAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Error())
            .ReturnsAsync(RepositoryResult<int>.Success(3));
        rig.Processor.Setup(p => p.ProcessDueAsync(It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync(0);

        await rig.Loop.RecoverAsync(TestContext.Current.CancellationToken);
        await rig.Loop.RunOnceAsync(TestContext.Current.CancellationToken);
        await rig.Loop.RunOnceAsync(TestContext.Current.CancellationToken);

        rig.Repository.Verify(r => r.ResetInterruptedAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task RecoverAsync_WhenTheResetThrows_StillPokesSoDueEventsAreProcessed()
    {
        var signal = new RecordingSignal();
        var rig = Build([], signal);
        rig.Repository.Setup(r => r.ResetInterruptedAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("database is down"));

        await rig.Loop.RecoverAsync(TestContext.Current.CancellationToken);

        signal.Pokes.Should().Be(1);
    }
}
