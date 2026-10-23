// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// keep-comment: stored as int, renumbering breaks existing rows
public enum HikeSubmissionStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
}
