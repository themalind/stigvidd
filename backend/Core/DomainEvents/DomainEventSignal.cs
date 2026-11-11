// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Threading.Channels;

namespace Core.DomainEvents;

// A poke carries no id and duplicates coalesce: the table says what is due, this only says "look now". keep-comment: why a lost poke is harmless
public sealed class DomainEventSignal : IDomainEventSignal
{
    private readonly Channel<bool> _channel = Channel.CreateBounded<bool>(new BoundedChannelOptions(1)
    {
        FullMode = BoundedChannelFullMode.DropWrite,
        SingleReader = true,
    });

    public void Poke()
    {
        _channel.Writer.TryWrite(true);
    }

    public async Task WaitAsync(TimeSpan timeout, CancellationToken ctoken)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ctoken);

        var poked = _channel.Reader.WaitToReadAsync(linked.Token).AsTask();
        var ticked = Task.Delay(timeout, linked.Token);

        await Task.WhenAny(poked, ticked);
        await linked.CancelAsync();

        // Observe the loser so its cancellation is not left unobserved. keep-comment: avoids an unobserved task exception
        await Task.WhenAll(poked, ticked).ContinueWith(_ => { }, TaskScheduler.Default);

        ctoken.ThrowIfCancellationRequested();

        _channel.Reader.TryRead(out _);
    }
}
