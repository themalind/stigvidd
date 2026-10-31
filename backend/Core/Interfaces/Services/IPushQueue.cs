// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

/// <summary>Pass FromUserId when a person triggered this; anyone who blocked them is skipped.</summary> keep-comment: the block filter is invisible at the call site
public sealed record PushMessage(
    IReadOnlyCollection<int> UserIds,
    string Title,
    string Body,
    IReadOnlyDictionary<string, object> Data,
    int? FromUserId = null);

// Not durable: a push still queued at a restart is lost. keep-comment: hidden constraint for callers
public interface IPushQueue
{
    void Enqueue(PushMessage message);
    IAsyncEnumerable<PushMessage> DequeueAllAsync(CancellationToken ctoken);
}
