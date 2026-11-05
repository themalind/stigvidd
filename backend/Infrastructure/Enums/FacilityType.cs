// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

[Flags]
public enum FacilityType
{
    None = 0,
    FirePit = 1,
    Shelter = 2,
    FishingArea = 4,
    SwimmingArea = 8,
    NatureReserve = 16,
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
