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
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
