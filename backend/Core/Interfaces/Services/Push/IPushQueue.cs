// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Push;

// Not durable: a push still queued at a restart is lost. keep-comment: hidden constraint for callers
public interface IPushQueue
{
    void Enqueue(PushMessage message);
    IAsyncEnumerable<PushMessage> DequeueAllAsync(CancellationToken ctoken);
}
