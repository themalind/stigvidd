// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

public interface IMediaReprocessQueue
{
    void Enqueue(int itemId);

    IAsyncEnumerable<int> DequeueAllAsync(CancellationToken ctoken);
}
