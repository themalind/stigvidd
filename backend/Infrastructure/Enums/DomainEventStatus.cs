// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

public enum DomainEventStatus
{
    Pending = 0,
    Processing = 1,
    Handled = 2,
    Failed = 3,
    Cancelled = 4,
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data. keep-comment: persisted values
