// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

public enum FriendRequestStatus
{
    Pending = 0,
    Accepted = 1
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.