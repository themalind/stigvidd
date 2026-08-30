// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

// Hands an uploaded session over to the background worker. Analysis takes tens of seconds
// against the full export, which is far too long to hold an HTTP request open.
public interface ITrailImportAnalysisQueue
{
    void Enqueue(int sessionId);
    IAsyncEnumerable<int> DequeueAllAsync(CancellationToken ctoken);
}
