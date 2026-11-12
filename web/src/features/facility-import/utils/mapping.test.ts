// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { FacilityImportMappingResponse } from "@/api/generated/model";
import type { FileSummary } from "./inspect";
import { guessMapping, guessType, initialMapping, mappingProblem, toRequest, type MappingDraft } from "./mapping";

const field = (name: string, values: string[] | null = null) => ({ name, samples: [], values });

const OUTDOOR: FileSummary = {
  points: 3,
  fields: [field("fid", null), field("Namn"), field("typ", ["Grillplats", "Toalett", "Vindskydd"])],
};
const BATHING: FileSummary = {
  points: 2,
  fields: [field("place_id"), field("name"), field("description"), field("visit_url")],
};

const draft = (overrides: Partial<MappingDraft>): MappingDraft => ({
  idField: "",
  nameField: "name",
  descriptionField: "",
  urlField: "",
  typeField: "",
  fixedType: 8,
  typeValues: {},
  ...overrides,
});

describe("guessMapping", () => {
  it("finds the common fields whatever their case, and never takes fid as the id", () => {
    expect(guessMapping(OUTDOOR)).toEqual({
      idField: "",
      nameField: "Namn",
      descriptionField: "",
      urlField: "",
      typeField: "typ",
      fixedType: 0,
      typeValues: { Grillplats: 1, Toalett: 0, Vindskydd: 2 },
    });
  });

  it("takes the bathing export's fields and asks for a type", () => {
    expect(guessMapping(BATHING)).toMatchObject({
      idField: "place_id",
      nameField: "name",
      descriptionField: "description",
      urlField: "visit_url",
      typeField: "",
    });
  });

  it("does not sort on a type field with too many values", () => {
    expect(guessMapping({ points: 1, fields: [field("typ", null)] }).typeField).toBe("");
  });
});

describe("guessType", () => {
  it.each([
    ["Grillplats", 1],
    ["Vindskydd", 2],
    ["Fiskeplats", 4],
    ["Badplats", 8],
    ["Naturreservat", 16],
    ["Toalett", 0],
  ])("%s gives %i", (value, type) => {
    expect(guessType(value)).toBe(type);
  });
});

describe("initialMapping", () => {
  const saved: FacilityImportMappingResponse = {
    idField: "fid",
    nameField: "Namn",
    descriptionField: "beskrivning",
    urlField: null,
    typeField: "typ",
    fixedType: 0,
    typeValues: [
      { value: "Grillplats", facilityType: 2 },
      { value: "Raststuga", facilityType: 2 },
    ],
  };

  it("keeps the saved choices the file still has and guesses the rest", () => {
    expect(initialMapping(OUTDOOR, saved)).toEqual({
      idField: "fid",
      nameField: "Namn",
      descriptionField: "",
      urlField: "",
      typeField: "typ",
      fixedType: 0,
      typeValues: { Grillplats: 2, Toalett: 0, Vindskydd: 2 },
    });
  });

  it("keeps the saved id field even when the file lacks it, instead of guessing another", () => {
    const file: FileSummary = { points: 1, fields: [field("id"), field("Namn")] };

    expect(initialMapping(file, saved).idField).toBe("fid");
  });

  it("guesses everything for a data source with nothing saved", () => {
    expect(initialMapping(OUTDOOR, null)).toEqual(guessMapping(OUTDOOR));
  });
});

describe("mappingProblem", () => {
  it.each<[Partial<MappingDraft>, string | null]>([
    [{}, null],
    [{ nameField: "" }, "Choose the field that holds the name."],
    [{ fixedType: 0 }, "Choose a facility type for the file."],
    [{ typeField: "typ", typeValues: { Toalett: 0 } }, "Give at least one value a facility type."],
    [{ typeField: "typ", fixedType: 0, typeValues: { Grillplats: 1 } }, null],
    [{ idField: "place_id" }, null],
    [{ idField: "objectid" }, "The file has no objectid, which this data source's facilities are matched by."],
  ])("%o gives %s", (overrides, problem) => {
    expect(mappingProblem(draft(overrides), BATHING)).toBe(problem);
  });
});

describe("toRequest", () => {
  it("sends no field as null and a fixed type without values", () => {
    expect(toRequest(draft({ typeValues: { Badplats: 8 } }))).toEqual({
      idField: null,
      nameField: "name",
      descriptionField: null,
      urlField: null,
      typeField: null,
      fixedType: 8,
      typeValues: [],
    });
  });

  it("sends the values and no fixed type when a field gives the type", () => {
    expect(toRequest(draft({ typeField: "typ", typeValues: { Grillplats: 1, Toalett: 0 } }))).toMatchObject({
      typeField: "typ",
      fixedType: 0,
      typeValues: [
        { value: "Grillplats", facilityType: 1 },
        { value: "Toalett", facilityType: 0 },
      ],
    });
  });
});
