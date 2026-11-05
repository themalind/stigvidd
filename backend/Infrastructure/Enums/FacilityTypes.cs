// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

public static class FacilityTypes
{
    public const FacilityType Known =
      FacilityType.FirePit | FacilityType.Shelter | FacilityType.FishingArea
      | FacilityType.SwimmingArea | FacilityType.NatureReserve;

    // keep-comment: true for any non-empty combination of known flags
    public static bool IsKnown(int value) => value != 0 && ((FacilityType)value & ~Known) == 0;
}
