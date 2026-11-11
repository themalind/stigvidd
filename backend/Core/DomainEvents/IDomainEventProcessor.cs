// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.DomainEvents;

public interface IDomainEventProcessor
{
    Task<int> ProcessDueAsync(int batchSize, CancellationToken ctoken);
}
