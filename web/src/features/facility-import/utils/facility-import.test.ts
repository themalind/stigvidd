// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { FacilityImportFieldChangeResponse, FacilityImportRowResponse } from "@/api/generated/model";
import { facilityTypeLabel } from "@/utils/facility-types";
import {
  changeText,
  CREATE_NEW,
  choicesOf,
  countByKind,
  isLink,
  keptOf,
  linksOf,
  markChoice,
  markKept,
  sortRows,
  takenElsewhere,
} from "./facility-import";

const row = (overrides: Partial<FacilityImportRowResponse>): FacilityImportRowResponse => ({
  sourceId: "boras-badplatser:1",
  name: "Almenäs badplats",
  kind: "New",
  facilityType: 8,
  facilityIdentifier: null,
  facilityName: null,
  suggestedFacilityIdentifier: null,
  suggestedFacilityName: null,
  changes: [],
  ...overrides,
});

describe("changeText", () => {
  it("names the facility types of a Type change and leaves other fields as they are", () => {
    expect(changeText("Type", "3")).toBe(facilityTypeLabel(3));
    expect(changeText("Name", "3")).toBe("3");
  });
});

describe("sortRows", () => {
  it("puts what needs a decision first, then by name", () => {
    const rows = [
      row({ name: "Ö", kind: "Unchanged" }),
      row({ name: "B", kind: "Changed" }),
      row({ name: "Å", kind: "New" }),
      row({ name: "A", kind: "New" }),
      row({ name: "C", kind: "Missing" }),
    ];

    expect(sortRows(rows).map((r) => r.name)).toEqual(["A", "Å", "B", "C", "Ö"]);
  });
});

describe("countByKind", () => {
  it("counts every kind, zero included", () => {
    expect(countByKind([row({ kind: "New" }), row({ kind: "New" }), row({ kind: "Missing" })])).toEqual({
      New: 2,
      Changed: 0,
      Missing: 1,
      Unchanged: 0,
    });
  });
});

const rows = [
  row({ sourceId: "s1", facilityIdentifier: "f1" }),
  row({ sourceId: "s2" }),
  row({ sourceId: "s3", kind: "Changed", facilityIdentifier: "f3" }),
];

describe("isLink", () => {
  it("is a new row joined to a facility we have, not a created or an already linked one", () => {
    expect(rows.map(isLink)).toEqual([true, false, false]);
  });
});

describe("linksOf", () => {
  it("states the choice of every new row that differs from its suggestion, a new facility as null", () => {
    expect(linksOf(rows)).toEqual([{ sourceId: "s1", facilityIdentifier: "f1" }]);
  });

  it("sends nothing for a row that keeps its suggestion, and null for one that turns it down", () => {
    const suggested = [
      row({ sourceId: "s1", facilityIdentifier: "f1", suggestedFacilityIdentifier: "f1" }),
      row({ sourceId: "s2", facilityIdentifier: null, suggestedFacilityIdentifier: "f2" }),
    ];

    expect(linksOf(suggested)).toEqual([{ sourceId: "s2", facilityIdentifier: null }]);
  });

  it("stays within the server's limit when a large file only takes its suggestions", () => {
    const many = Array.from({ length: 1500 }, (_, i) => row({ sourceId: `s${i}` }));

    expect(linksOf(many)).toEqual([]);
  });
});

describe("markChoice", () => {
  it("replaces one row's choice and keeps the rest", () => {
    expect(linksOf(markChoice(rows, "s1", CREATE_NEW))).toEqual([]);
    expect(linksOf(markChoice(rows, "s2", "f9"))).toContainEqual({ sourceId: "s2", facilityIdentifier: "f9" });
  });
});

const change = (
  field: FacilityImportFieldChangeResponse["field"],
  kept: boolean,
): FacilityImportFieldChangeResponse => ({
  field,
  current: "ours",
  incoming: "theirs",
  overwritesLocalEdit: true,
  kept,
});

const withKept = [
  row({ sourceId: "s1", facilityIdentifier: "f1", changes: [change("Name", true), change("Url", false)] }),
  row({ sourceId: "s3", kind: "Changed", facilityIdentifier: "f3", changes: [change("Description", true)] }),
];

describe("keptOf", () => {
  it("lists the kept fields of every row", () => {
    expect(keptOf(withKept)).toEqual([
      { sourceId: "s1", field: "Name" },
      { sourceId: "s3", field: "Description" },
    ]);
  });
});

describe("markKept", () => {
  it("keeps or releases one field and leaves the rest", () => {
    expect(keptOf(markKept(withKept, "s1", "Url", true))).toContainEqual({ sourceId: "s1", field: "Url" });
    expect(keptOf(markKept(withKept, "s1", "Name", false))).toEqual([{ sourceId: "s3", field: "Description" }]);
  });
});

describe("choicesOf", () => {
  it("sends back both the links and the kept fields", () => {
    expect(choicesOf(withKept)).toEqual({
      links: [{ sourceId: "s1", facilityIdentifier: "f1" }],
      kept: keptOf(withKept),
    });
  });
});

describe("takenElsewhere", () => {
  it("lists the facilities other new rows link to", () => {
    expect([...takenElsewhere(rows, "s2")]).toEqual(["f1"]);
    expect([...takenElsewhere(rows, "s1")]).toEqual([]);
  });
});
