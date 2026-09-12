// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// Which table a report points at. Unknown owns the zero deliberately: the discriminator
// decides what gets hidden, and a defaulted row that quietly meant Review would hide the
// wrong row in the wrong table.
public enum ReportedContentType
{
    Unknown = 0,
    Review = 1,
    TrailObstacle = 2,
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
