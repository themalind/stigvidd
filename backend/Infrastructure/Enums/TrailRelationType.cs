// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// How one trail relates to another.
public enum TrailRelationType
{
    PartOf = 0,       // From is a stage of To; directed, and ordered by Sequence
    Alternative = 1,  // From and To are two routings of the same trail; symmetric
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
