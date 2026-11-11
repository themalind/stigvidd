// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Diagnostics;
using AwesomeAssertions;
using Core.DomainEvents;

namespace UnitTests.DomainEvents;

public class DomainEventSignalTests
{
    private static readonly TimeSpan Long = TimeSpan.FromSeconds(30);

    private static async Task<bool> CompletesQuicklyAsync(Task task)
    {
        var winner = await Task.WhenAny(task, Task.Delay(TimeSpan.FromSeconds(5), TestContext.Current.CancellationToken));
        return winner == task;
    }

    [Fact]
    public async Task WaitAsync_AfterAPoke_ReturnsAtOnce()
    {
        var signal = new DomainEventSignal();
        signal.Poke();

        var wait = signal.WaitAsync(Long, TestContext.Current.CancellationToken);

        (await CompletesQuicklyAsync(wait)).Should().BeTrue();
    }

    [Fact]
    public async Task WaitAsync_WhenPokedWhileWaiting_ReturnsAtOnce()
    {
        var signal = new DomainEventSignal();
        var wait = signal.WaitAsync(Long, TestContext.Current.CancellationToken);

        signal.Poke();

        (await CompletesQuicklyAsync(wait)).Should().BeTrue();
    }

    [Fact]
    public async Task WaitAsync_WithNoPoke_ReturnsWhenTheTimeoutElapses()
    {
        var signal = new DomainEventSignal();
        var clock = Stopwatch.StartNew();

        await signal.WaitAsync(TimeSpan.FromMilliseconds(300), TestContext.Current.CancellationToken);

        clock.Elapsed.Should().BeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(250));
    }

    [Fact]
    public async Task TwoPokes_CoalesceIntoOneWake()
    {
        var signal = new DomainEventSignal();
        signal.Poke();
        signal.Poke();
        await signal.WaitAsync(Long, TestContext.Current.CancellationToken);
        var clock = Stopwatch.StartNew();

        await signal.WaitAsync(TimeSpan.FromMilliseconds(300), TestContext.Current.CancellationToken);

        clock.Elapsed.Should().BeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(250));
    }

    [Fact]
    public async Task WaitAsync_WhenCancelled_ThrowsAndTheSignalStaysUsable()
    {
        var signal = new DomainEventSignal();
        using var cancelled = new CancellationTokenSource();
        var wait = signal.WaitAsync(Long, cancelled.Token);

        await cancelled.CancelAsync();

        var act = () => wait;
        await act.Should().ThrowAsync<OperationCanceledException>();

        signal.Poke();
        (await CompletesQuicklyAsync(signal.WaitAsync(Long, TestContext.Current.CancellationToken))).Should().BeTrue();
    }

    [Fact]
    public async Task APokeDuringAPass_IsKeptForTheNextWait()
    {
        var signal = new DomainEventSignal();
        var first = signal.WaitAsync(Long, TestContext.Current.CancellationToken);
        signal.Poke();
        await first;

        signal.Poke();

        (await CompletesQuicklyAsync(signal.WaitAsync(Long, TestContext.Current.CancellationToken))).Should().BeTrue();
    }
}
