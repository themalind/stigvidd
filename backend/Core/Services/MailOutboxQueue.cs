// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using System.Threading.Channels;

namespace Core.Services;

// Unbounded on purpose. Bounding it would mean either blocking a caller that is sending
// transactional mail, or dropping a signal and waiting for the next restart to notice — and
// the ids are ints, so a backlog costs nothing worth economising on.
public class MailOutboxQueue : IMailOutboxQueue
{
    private readonly Channel<int> _ids = Channel.CreateUnbounded<int>(new UnboundedChannelOptions
    {
        SingleReader = true,
    });

    // TryWrite cannot fail on an unbounded channel, and the return is discarded for the same
    // reason the durable state is elsewhere: the OutboxEmails row is what guarantees delivery.
    public void Enqueue(int outboxEmailId) => _ids.Writer.TryWrite(outboxEmailId);

    public IAsyncEnumerable<int> DequeueAllAsync(CancellationToken ctoken) =>
        _ids.Reader.ReadAllAsync(ctoken);
}
