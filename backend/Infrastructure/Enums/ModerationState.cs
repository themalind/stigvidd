// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// Whether a piece of user content is visible. Hidden rows stay in the table until a
// moderator either restores them or deletes them outright.
public enum ModerationState
{
    Visible = 0,
    HiddenPendingReview = 1,
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
