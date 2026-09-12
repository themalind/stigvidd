// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// Where a report has got to. ContentExpired covers the content going away before anyone
// decided, and must not be Dismissed: that would count against a reporter who was right.
public enum ReportStatus
{
    Pending = 0,
    Dismissed = 1,
    Upheld = 2,
    ContentExpired = 3,
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
