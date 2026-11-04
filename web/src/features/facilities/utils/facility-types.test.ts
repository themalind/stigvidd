// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { facilityTypeLabel } from "./facility-types";

describe("facilityTypeLabel", () => {
  it("names a single type", () => {
    expect(facilityTypeLabel(2)).toBe("Shelter");
  });

  it("joins combined flags", () => {
    expect(facilityTypeLabel(1 | 8)).toBe("Fire pit, Swimming area");
  });

  it("says when no known flag is set", () => {
    expect(facilityTypeLabel(0)).toBe("Unknown type");
  });
});
