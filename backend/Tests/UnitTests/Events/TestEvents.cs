// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Events;

namespace UnitTests.Events;

[DomainEventName("test.ping")]
public sealed record TestPing(int Id) : IDomainEvent;

public abstract class ScriptedHandler : IDomainEventHandler<TestPing>
{
    private int _calls;

    public int Calls => _calls;

    public List<TestPing> Seen { get; } = [];

    public Func<TestPing, CancellationToken, Task<Result>> Behaviour { get; set; } = (_, _) => Task.FromResult(Result.Ok());

    public async Task<Result> HandleAsync(TestPing @event, CancellationToken ctoken)
    {
        Interlocked.Increment(ref _calls);
        Seen.Add(@event);
        return await Behaviour(@event, ctoken);
    }
}

public sealed class HandlerA : ScriptedHandler;

public sealed class HandlerB : ScriptedHandler;

public sealed class RecordingSignal : IDomainEventSignal
{
    public List<string> Log { get; } = [];

    public int Pokes => Log.Count(entry => entry == "poke");

    public void Poke() => Log.Add("poke");

    public Task WaitAsync(TimeSpan timeout, CancellationToken ctoken) => Task.CompletedTask;
}
