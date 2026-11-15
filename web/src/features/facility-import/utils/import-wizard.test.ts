// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { Preview, SourceFile } from "@/features/facility-import/api/facility-import";
import { initialWizard, readGeoJsonFile, wizardReducer, type ReadFile, type WizardState } from "./import-wizard";
import type { MappingDraft } from "./mapping";

const sourceFile: SourceFile = { sourceIdentifier: "s", geoJson: "{}", mapping: { nameField: "namn" } };
const preview: Preview = { rows: [], notes: [], unlinkedFacilities: [], hasWork: true, source: "boras:bad" };
const draft: MappingDraft = {
  idField: "",
  nameField: "namn",
  descriptionField: "",
  urlField: "",
  typeField: "",
  fixedType: 1,
  typeValues: {},
};

function readOf(file: File): ReadFile {
  return { file, geoJson: "{}", inspection: { ok: false, error: "x" } };
}

describe("wizardReducer", () => {
  const compared: WizardState = {
    ...initialWizard,
    sourceIdentifier: "s",
    edited: draft,
    shown: { file: sourceFile, preview },
    step: "Review",
  };

  it("forgets the edited mapping and the comparison when the source, municipality or file changes", () => {
    for (const action of [
      { type: "source", identifier: "t" },
      { type: "municipality", identifier: "m" },
      { type: "file", file: new File([], "b.geojson") },
    ] as const) {
      const next = wizardReducer(compared, action);

      expect(next.edited).toBeNull();
      expect(next.shown).toBeNull();
    }
  });

  it("clears the data source when the municipality changes", () => {
    expect(wizardReducer(compared, { type: "municipality", identifier: "m" }).sourceIdentifier).toBe("");
  });

  it("keeps an edited mapping but drops the comparison when the mapping changes", () => {
    const next = wizardReducer(compared, { type: "mapping", draft });

    expect(next.edited).toBe(draft);
    expect(next.shown).toBeNull();
  });

  it("drops a slow read of a file that was since replaced", () => {
    const first = new File([], "a.geojson");
    const second = new File([], "b.geojson");
    const state = wizardReducer(wizardReducer(initialWizard, { type: "file", file: first }), {
      type: "file",
      file: second,
    });

    expect(wizardReducer(state, { type: "read", read: readOf(first) }).read).toBeNull();
    expect(wizardReducer(state, { type: "read", read: readOf(second) }).read?.file).toBe(second);
  });

  it("drops a plan for a file that is no longer shown", () => {
    const other = { ...sourceFile, geoJson: "[]" };

    expect(wizardReducer(compared, { type: "planned", shown: { file: other, preview } })).toBe(compared);
  });

  it("starts another import at the file step with the source kept", () => {
    const next = wizardReducer({ ...compared, step: "Done" }, { type: "another" });

    expect(next.step).toBe("File");
    expect(next.sourceIdentifier).toBe("s");
    expect(next.shown).toBeNull();
    expect(next.file).toBeNull();
  });
});

describe("readGeoJsonFile", () => {
  it("reports a file that cannot be read instead of throwing", async () => {
    const broken = new File([], "x.geojson");
    broken.text = () => Promise.reject(new Error("gone"));

    const read = await readGeoJsonFile(broken);

    expect(read.inspection).toEqual({ ok: false, error: "The file could not be read." });
  });
});
