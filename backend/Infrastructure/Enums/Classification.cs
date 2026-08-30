// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

public enum Classification
{
    NotClassified = 0,
    Easy = 1,
    Medium = 2,
    Hard = 3
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.