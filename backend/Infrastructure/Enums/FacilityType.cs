// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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

public static class FacilityTypes
{
    public const FacilityType Known =
      FacilityType.FirePit | FacilityType.Shelter | FacilityType.FishingArea
      | FacilityType.SwimmingArea | FacilityType.NatureReserve;

    // True for any non-empty combination of known flags.
    public static bool IsKnown(int value) => value != 0 && ((FacilityType)value & ~Known) == 0;
}