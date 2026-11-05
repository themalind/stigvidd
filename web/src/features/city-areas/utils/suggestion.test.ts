// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { AdminAreaSuggestionResponse } from "@/api/generated/model";
import { bySuggestedArea, suggestionReason, suggestionTitle, type UnlinkedRow } from "./suggestion";

function suggestion(overrides: Partial<AdminAreaSuggestionResponse> = {}): AdminAreaSuggestionResponse {
  return {
    areaIdentifier: "a-1",
    areaName: "Rya åsar",
    reason: "Nearby",
    distanceKm: 1.2,
    nearestName: "Ryaslingan ",
    ...overrides,
  };
}

function row(label: string, areaName?: string): UnlinkedRow {
  return { identifier: label, label, suggestions: areaName ? [suggestion({ areaName })] : [] };
}

describe("suggestionReason", () => {
  it("gives the distance for a nearby area", () => {
    expect(suggestionReason(suggestion())).toBe("1.2 km");
  });

  it("says when the name gave the area away, with the distance when there is one", () => {
    expect(suggestionReason(suggestion({ reason: "Name" }))).toBe("name, 1.2 km");
    expect(suggestionReason(suggestion({ reason: "Name", distanceKm: null, nearestName: null }))).toBe("name");
  });
});

describe("suggestionTitle", () => {
  it("names the closest linked place", () => {
    expect(suggestionTitle(suggestion())).toBe("1.2 km from Ryaslingan");
    expect(suggestionTitle(suggestion({ reason: "Name" }))).toBe("The name mentions Rya åsar, 1.2 km from Ryaslingan");
  });
});

describe("bySuggestedArea", () => {
  it("groups by first suggested area, then name, with unsuggested rows last", () => {
    const rows = [row("Vindskydd"), row("Grill B", "Öresjö"), row("Grill A", "Öresjö"), row("Bad", "Kype")];

    expect(rows.sort(bySuggestedArea).map((r) => r.label)).toEqual(["Bad", "Grill A", "Grill B", "Vindskydd"]);
  });
});
