// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// Where a queued mail has got to. The row, not the in-memory queue, is the truth: the
// dispatcher reconciles against these on every start.
public enum OutboxEmailStatus
{
    Pending = 0,
    Sending = 1,
    Sent = 2,
    Failed = 3,

    // Stopped by an operator from the admin outbox before it was ever claimed. A distinct value
    // rather than a flag on Pending: GetPendingIdsAsync and ResetInterruptedAsync both select on
    // an exact status, so a cancelled row is invisible to the boot re-signal for free. Modelled
    // as "Pending plus a CancelledAt" it would be resurrected on every restart, and no test on a
    // process that never dies would show it.
    Cancelled = 4,
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
