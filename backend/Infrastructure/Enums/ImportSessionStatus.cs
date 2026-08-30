// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// Where an uploaded source file has got to. Nothing touches Trails before Applying.
public enum ImportSessionStatus
{
    Uploaded = 0,
    Analyzing = 1,
    AwaitingReview = 2,
    Applying = 3,
    Applied = 4,
    Failed = 5,
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
