// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bits of the backend's [Flags] enum Infrastructure.Enums.FacilityType. keep-comment: cross-repo coupling, nothing checks it
const FACILITY_TYPES: readonly [number, string][] = [
  [1, "Fire pit"],
  [2, "Shelter"],
  [4, "Fishing area"],
  [8, "Swimming area"],
  [16, "Nature reserve"],
];

export function facilityTypeLabel(flags: number): string {
  const labels = FACILITY_TYPES.filter(([bit]) => (flags & bit) !== 0).map(([, label]) => label);
  return labels.length > 0 ? labels.join(", ") : "Unknown type";
}
