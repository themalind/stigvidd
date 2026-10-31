// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

public enum UserAction
{
    EventCreated = 0,
    EventInvited = 1,
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data. keep-comment: stored values
