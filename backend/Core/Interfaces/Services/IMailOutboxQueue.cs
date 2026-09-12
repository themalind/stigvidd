// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

// Tells the dispatcher that row N is worth looking at now, so a mail leaves within
// milliseconds instead of waiting for a poll tick.
//
// It carries a hint, not the work and not the claim. Everything durable is in the OutboxEmails
// row: a signal that is never delivered (a crash between the insert and the send, a restart
// during a backoff) costs latency only, because the dispatcher re-signals every Pending row
// on start. A signal delivered twice is harmless for the same reason — claiming is a
// Pending -> Sending transition in the database, so the second one finds nothing to do.
public interface IMailOutboxQueue
{
    void Enqueue(int outboxEmailId);
    IAsyncEnumerable<int> DequeueAllAsync(CancellationToken ctoken);
}
