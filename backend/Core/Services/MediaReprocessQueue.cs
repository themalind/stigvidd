// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using System.Threading.Channels;

namespace Core.Services;

public class MediaReprocessQueue : IMediaReprocessQueue
{
    private readonly Channel<int> _ids = Channel.CreateUnbounded<int>(new UnboundedChannelOptions
    {
        SingleReader = true,
    });

    public void Enqueue(int itemId) => _ids.Writer.TryWrite(itemId);

    public IAsyncEnumerable<int> DequeueAllAsync(CancellationToken ctoken) =>
        _ids.Reader.ReadAllAsync(ctoken);
}
