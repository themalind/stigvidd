// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;

namespace UnitTests.ServiceTests;

public class MaintenanceGateTests
{
    [Fact]
    public async Task Wait_WhenNotPaused_CompletesAtOnce()
    {
        var gate = new MaintenanceGate();

        await gate.WaitWhilePausedAsync(TestContext.Current.CancellationToken);

        gate.IsPaused.Should().BeFalse();
    }

    [Fact]
    public async Task Wait_WhilePaused_CompletesOnlyWhenThePauseEnds()
    {
        var gate = new MaintenanceGate();
        var pause = gate.Pause();

        var waiting = gate.WaitWhilePausedAsync(TestContext.Current.CancellationToken);
        await Task.Delay(50, TestContext.Current.CancellationToken);
        waiting.IsCompleted.Should().BeFalse();

        pause.Dispose();
        await waiting.WaitAsync(TimeSpan.FromSeconds(5), TestContext.Current.CancellationToken);

        gate.IsPaused.Should().BeFalse();
    }

    [Fact]
    public void Pause_WhileAlreadyPaused_IsRefused()
    {
        var gate = new MaintenanceGate();
        using var first = gate.Pause();

        var act = () => gate.Pause();

        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public async Task Wait_IsCancellable()
    {
        var gate = new MaintenanceGate();
        using var pause = gate.Pause();
        using var cts = new CancellationTokenSource();

        var waiting = gate.WaitWhilePausedAsync(cts.Token);
        await cts.CancelAsync();

        await FluentActions.Awaiting(() => waiting).Should().ThrowAsync<OperationCanceledException>();
    }
}
