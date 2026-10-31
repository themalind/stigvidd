// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using System.Threading.Channels;

namespace Core.Services.Push;

public class PushQueue : IPushQueue
{
    private readonly Channel<PushMessage> _messages = Channel.CreateUnbounded<PushMessage>(new UnboundedChannelOptions
    {
        SingleReader = true,
    });

    public void Enqueue(PushMessage message)
    {
        _messages.Writer.TryWrite(message);
    }

    public IAsyncEnumerable<PushMessage> DequeueAllAsync(CancellationToken ctoken)
    {
        return _messages.Reader.ReadAllAsync(ctoken);
    }
}
