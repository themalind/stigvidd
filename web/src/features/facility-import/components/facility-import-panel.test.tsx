// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  CreateFacilityImportSourceRequest,
  CreateMunicipalityRequest,
  FacilityImportMappingResponse,
  FacilityImportPreviewResponse,
  FacilityImportRequest,
  FacilityImportRowResponse,
  FacilityImportSourceResponse,
  MunicipalityResponse,
} from "@/api/generated/model";
import { ApiError } from "@/api/mutator";
import { answerConfirm } from "@/testing/confirm";
import { renderWithProviders } from "@/testing/render";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

import { FacilityImportPanel } from "./facility-import-panel";

const APPLY = "/api/v1/admin/facilities/import";
const PREVIEW = "/api/v1/admin/facilities/import/preview";
const MUNICIPALITIES = "/api/v1/admin/municipalities";
const SOURCES = "/api/v1/admin/facilities/import/sources";
const BORAS: MunicipalityResponse = { identifier: "m-boras", name: "Borås", slug: "boras" };
const SWIMMING = 8;

const feature = (properties: Record<string, unknown>, lon = 12.94, lat = 57.76) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties,
});
const fileOf = (...features: unknown[]) => JSON.stringify({ type: "FeatureCollection", features });

const GEOJSON = fileOf(
  feature({ place_id: "1490-6472", name: "Almenäs badplats", description: "Sandstrand", visit_url: "https://x.se" }),
);
const OUTDOOR = fileOf(
  feature({ fid: 1, namn: "Kypegrillen", typ: "Grillplats" }),
  feature({ fid: 2, namn: "Kypeskyddet", typ: "Vindskydd" }),
  feature({ fid: 3, namn: "Kypetoan", typ: "Toalett" }),
);
const ALMENAS = "boras-badplatser:1490-6472";

const BATHING_MAPPING: FacilityImportMappingResponse = {
  idField: "place_id",
  nameField: "name",
  descriptionField: "description",
  urlField: "visit_url",
  typeField: null,
  fixedType: SWIMMING,
  typeValues: [],
};

const BADPLATSER: FacilityImportSourceResponse = {
  identifier: "s-badplatser",
  name: "Badplatser",
  key: "boras-badplatser",
  municipalityIdentifier: "m-boras",
  municipalityName: "Borås",
  mapping: BATHING_MAPPING,
};

const rows: FacilityImportRowResponse[] = [
  {
    sourceId: ALMENAS,
    name: "Almenäs badplats",
    kind: "New",
    facilityType: SWIMMING,
    facilityIdentifier: "mock-almenas",
    facilityName: "Almenäs",
    suggestedFacilityIdentifier: "mock-almenas",
    suggestedFacilityName: "Almenäs",
    changes: [
      { field: "Name", current: "Almenäs", incoming: "Almenäs strandbad", overwritesLocalEdit: true, kept: false },
      {
        field: "Coordinates",
        current: null,
        incoming: "57.761776, 12.939644",
        overwritesLocalEdit: false,
        kept: false,
      },
    ],
  },
  {
    sourceId: "boras-badplatser:1490-6473",
    name: "Asklanda badplats",
    kind: "Changed",
    facilityType: SWIMMING,
    facilityIdentifier: "asklanda",
    facilityName: "Asklanda badplats",
    suggestedFacilityIdentifier: null,
    suggestedFacilityName: null,
    changes: [
      { field: "Description", current: "Vår text", incoming: "Kommunens text", overwritesLocalEdit: true, kept: false },
    ],
  },
  {
    sourceId: "boras-badplatser:1490-6474",
    name: "Dalsjön badplats",
    kind: "Unchanged",
    facilityType: SWIMMING,
    facilityIdentifier: "dalsjon",
    facilityName: "Dalsjön badplats",
    suggestedFacilityIdentifier: null,
    suggestedFacilityName: null,
    changes: [],
  },
];

let hasWork = true;
let allUnchanged = false;
let suggest = true;
let extraRows: FacilityImportRowResponse[] = [];
let notes: string[] = [];
let municipalities: MunicipalityResponse[] = [];
let sources: FacilityImportSourceResponse[] = [];

// keep-comment: answers like the server: a row without a choice takes its suggestion, null creates a new one, kept fields are marked
function previewFor(request: FacilityImportRequest): FacilityImportPreviewResponse {
  const chosen = new Map((request.links ?? []).map((link) => [link.sourceId, link.facilityIdentifier ?? null]));
  const kept = new Set((request.kept ?? []).map((keep) => `${keep.sourceId}/${keep.field}`));

  return {
    source: sources.find((s) => s.identifier === request.sourceIdentifier)?.key ?? "",
    rows: [...rows, ...extraRows].map((row) => {
      if (allUnchanged) return { ...row, kind: "Unchanged", changes: [] };
      const base =
        suggest || row.kind !== "New"
          ? row
          : { ...row, suggestedFacilityIdentifier: null, suggestedFacilityName: null, facilityIdentifier: null };
      const changes = base.changes.map((change) => ({ ...change, kept: kept.has(`${row.sourceId}/${change.field}`) }));
      return base.kind === "New" && chosen.has(row.sourceId)
        ? { ...base, changes, facilityIdentifier: chosen.get(row.sourceId) ?? null }
        : { ...base, changes };
    }),
    unlinkedFacilities: [
      { identifier: "mock-almenas", name: "Almenäs", facilityType: SWIMMING },
      { identifier: "mock-grill", name: "Almenäsgrillen", facilityType: 1 },
    ],
    hasWork,
    notes,
  };
}

const calls = (path: string) => api.mock.calls.filter((call) => call.method === "POST" && call.path === path);
const continueButton = () => screen.getByRole("button", { name: "Continue" });
const compareButton = () => screen.getByRole("button", { name: "Compare with what we have" });
const saveButton = () => screen.getByRole("button", { name: "Save import" });
const linkButton = () => screen.getByRole("button", { name: "Link to ours" });
const createButton = () => screen.getByRole("button", { name: "Create new" });

function renderPanel() {
  return renderWithProviders(<FacilityImportPanel />, { initialEntries: ["/facility-import"] });
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest("li");
  if (!row) throw new Error(`expected a row for ${name}`);
  return row;
}

function group(title: string): HTMLElement {
  return screen.getByRole("region", { name: title });
}

async function choose(label: string, name: string) {
  await screen.findByRole("option", { name });
  await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled());
  await userEvent.selectOptions(screen.getByLabelText(label), name);
}

async function chooseBadplatser() {
  await choose("Municipality", "Borås");
  await userEvent.click(screen.getByRole("button", { name: /^Badplatser/ }));
  await userEvent.click(continueButton());
}

async function addSource(name: string) {
  await choose("Municipality", "Borås");
  await userEvent.click(screen.getByRole("button", { name: /A new data source/ }));
  await userEvent.type(screen.getByLabelText("Name it after what the file holds"), name);
  await userEvent.click(continueButton());
  await screen.findByLabelText("File");
}

async function chooseFile(content = GEOJSON) {
  await userEvent.upload(
    screen.getByLabelText("File"),
    new File([content], "anlaggningar.geojson", { type: "application/geo+json" }),
  );
}

async function continueToFields(content = GEOJSON) {
  await chooseFile(content);
  await waitFor(() => expect(continueButton()).toBeEnabled());
  await userEvent.click(continueButton());
}

async function previewBoras() {
  renderPanel();
  await chooseBadplatser();
  await continueToFields();
  await userEvent.click(compareButton());
  await screen.findByRole("heading", { name: "Check before saving" });
}

async function save() {
  await userEvent.click(saveButton());
  return answerConfirm("yes");
}

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  hasWork = true;
  allUnchanged = false;
  suggest = true;
  extraRows = [];
  notes = [];
  municipalities = [BORAS];
  sources = [BADPLATSER];
  api.mock.on("GET", MUNICIPALITIES, () => municipalities);
  api.mock.on("POST", MUNICIPALITIES, (body) => {
    const name = (body as CreateMunicipalityRequest).name ?? "";
    const created = { identifier: `m-${name.toLowerCase()}`, name, slug: name.toLowerCase() };
    municipalities = [...municipalities, created];
    return created;
  });
  api.mock.on("GET", SOURCES, () => sources);
  api.mock.on("POST", SOURCES, (body) => {
    const request = body as CreateFacilityImportSourceRequest;
    const municipality = municipalities.find((m) => m.identifier === request.municipalityIdentifier);
    const name = request.name ?? "";
    const slug = name.toLowerCase();
    const created: FacilityImportSourceResponse = {
      identifier: `s-${slug}`,
      name,
      key: `${municipality?.slug}-${slug}`,
      municipalityIdentifier: request.municipalityIdentifier ?? "",
      municipalityName: municipality?.name ?? "",
      mapping: null,
    };
    sources = [...sources, created];
    return created;
  });
  api.mock.on("POST", PREVIEW, (body) => previewFor(body as FacilityImportRequest));
  api.mock.on("POST", APPLY, () => ({ created: 0, linked: 1, updated: 1, unchanged: 1, missing: 0 }));
});

describe("FacilityImportPanel, source and file", () => {
  it("asks for a municipality and a data source before going on", async () => {
    renderPanel();

    expect(continueButton()).toBeDisabled();
    expect(screen.getByText("Choose a municipality to continue.")).toBeInTheDocument();
    await choose("Municipality", "Borås");
    expect(screen.getByText("Choose a data source to continue.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Badplatser/ }));

    expect(screen.getByRole("button", { name: /^Badplatser/ })).toHaveAttribute("aria-pressed", "true");
    expect(continueButton()).toBeEnabled();
    expect(screen.queryByLabelText("File")).not.toBeInTheDocument();
  });

  it("adds a municipality from the list and picks it", async () => {
    renderPanel();

    await choose("Municipality", "Add a municipality…");
    await userEvent.type(screen.getByLabelText("New municipality"), "Ulricehamn");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(screen.getByLabelText("Municipality")).toHaveValue("m-ulricehamn"));
    expect(calls(MUNICIPALITIES)[0]?.body).toEqual({ name: "Ulricehamn" });
    expect(screen.getByText("Choose a data source to continue.")).toBeInTheDocument();
  });

  it("lists only the chosen municipality's data sources", async () => {
    sources = [BADPLATSER, { ...BADPLATSER, identifier: "s-mark", name: "Markbad", municipalityIdentifier: "m-mark" }];
    renderPanel();

    await choose("Municipality", "Borås");

    expect(screen.getByRole("button", { name: /^Badplatser/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Markbad/ })).not.toBeInTheDocument();
  });

  it("asks a new data source for a name, then adds it under the municipality", async () => {
    renderPanel();
    await choose("Municipality", "Borås");
    await userEvent.click(screen.getByRole("button", { name: /A new data source/ }));

    expect(screen.getByText("Give the new data source a name to continue.")).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Name it after what the file holds"), "Grillplatser");
    await userEvent.click(continueButton());

    await screen.findByLabelText("File");
    expect(calls(SOURCES)[0]?.body).toEqual({ municipalityIdentifier: "m-boras", name: "Grillplatser" });
    expect(screen.getByText("Borås · Grillplatser")).toBeInTheDocument();
  });

  it("asks for a file and says how many points it read", async () => {
    renderPanel();
    await chooseBadplatser();

    expect(screen.getByText("Choose a file to continue.")).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();
    await chooseFile(OUTDOOR);

    expect(await screen.findByText("3 points read.")).toBeInTheDocument();
    expect(continueButton()).toBeEnabled();
  });

  it("says why a file cannot be read", async () => {
    renderPanel();
    await chooseBadplatser();

    await chooseFile("not json");

    expect(await screen.findByRole("alert")).toHaveTextContent("The file is not valid GeoJSON.");
    expect(continueButton()).toBeDisabled();
  });

  it("keeps the newest file when an earlier one finishes reading last", async () => {
    renderPanel();
    await chooseBadplatser();
    let finishFirst: (text: string) => void = () => {};
    const slow = new File(["ignored"], "slow.geojson", { type: "application/geo+json" });
    Object.defineProperty(slow, "text", {
      value: () =>
        new Promise<string>((resolve) => {
          finishFirst = resolve;
        }),
    });

    await userEvent.upload(screen.getByLabelText("File"), slow);
    await chooseFile();
    await waitFor(() => expect(continueButton()).toBeEnabled());
    await act(async () => {
      finishFirst("not json");
      await Promise.resolve();
    });

    expect(continueButton()).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("FacilityImportPanel, fields", () => {
  it("shows the first places as they will be imported", async () => {
    renderPanel();
    await chooseBadplatser();
    await continueToFields();

    const table = within(screen.getByRole("table", { name: "How the first places will look" }));
    expect(table.getByText("Almenäs badplats")).toBeInTheDocument();
    expect(table.getByText("Swimming area")).toBeInTheDocument();
    expect(table.getByText("1490-6472")).toBeInTheDocument();
  });

  it("guesses a new data source's columns and maps each kind", async () => {
    renderPanel();
    await addSource("Grillplatser");
    await continueToFields(OUTDOOR);

    expect(screen.getByLabelText("Which column is the name?")).toHaveValue("namn");
    expect(screen.getByLabelText("Which column is the place's own id?")).toHaveValue("");
    expect(screen.getByRole("button", { name: /The kind is in a column/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Column with the kind")).toHaveValue("typ");
    expect(screen.getByLabelText("Grillplats")).toHaveValue("1");
    expect(screen.getByLabelText("Vindskydd")).toHaveValue("2");
    expect(screen.getByLabelText("Toalett")).toHaveValue("0");
    expect(within(screen.getByRole("table")).getByText("Left out")).toBeInTheDocument();

    await userEvent.click(compareButton());

    await waitFor(() => expect(calls(PREVIEW)).toHaveLength(1));
    expect(calls(PREVIEW)[0]?.body).toMatchObject({
      sourceIdentifier: "s-grillplatser",
      mapping: {
        idField: null,
        nameField: "namn",
        typeField: "typ",
        fixedType: 0,
        typeValues: [
          { value: "Grillplats", facilityType: 1 },
          { value: "Toalett", facilityType: 0 },
          { value: "Vindskydd", facilityType: 2 },
        ],
      },
    });
  });

  it("asks for one type when every place is the same kind", async () => {
    renderPanel();
    await addSource("Bad");
    await continueToFields();

    expect(screen.getByText("Choose a facility type for the file.")).toBeInTheDocument();
    expect(compareButton()).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText("Every place in the file becomes"), "Swimming area");

    expect(compareButton()).toBeEnabled();
  });

  it("lets points without a kind be given a type or left out", async () => {
    renderPanel();
    await addSource("Grillplatser");
    await continueToFields(fileOf(feature({ namn: "Grillen", typ: "Grillplats" }), feature({ namn: "Okänd" })));

    expect(screen.getByLabelText("(no value)")).toHaveValue("0");
    await userEvent.click(compareButton());
    await waitFor(() => expect(calls(PREVIEW)).toHaveLength(1));
    expect(calls(PREVIEW)[0]?.body).toMatchObject({
      mapping: {
        typeValues: [
          { value: "Grillplats", facilityType: 1 },
          { value: "", facilityType: 0 },
        ],
      },
    });
  });

  it("keeps a data source's id column and says when the file lacks it", async () => {
    renderPanel();
    await chooseBadplatser();

    await continueToFields(fileOf(feature({ id: "1", name: "Almenäs badplats" })));

    expect(screen.getByText(/The file has no place_id/)).toBeInTheDocument();
    expect(screen.getByLabelText("Which column is the place's own id?")).toHaveValue("place_id");
    expect(screen.getByLabelText("Which column is the place's own id?")).toBeDisabled();
    expect(compareButton()).toBeDisabled();
  });

  it("shows the server's reason once when the preview is refused, and stays on the fields", async () => {
    const reason = "The file uses the coordinate system EPSG:3006. Export it as WGS84 (EPSG:4326).";
    api.mock.on("POST", PREVIEW, () => {
      throw new ApiError(reason, 400);
    });
    renderPanel();
    await chooseBadplatser();
    await continueToFields();

    await userEvent.click(compareButton());

    await waitFor(() => expect(toasts.error).toHaveBeenCalledExactlyOnceWith(reason));
    expect(compareButton()).toBeEnabled();
  });
});

describe("FacilityImportPanel, review", () => {
  it("compares with the data source's saved columns and leads with the places that might exist", async () => {
    await previewBoras();

    expect(calls(PREVIEW)[0]?.body).toEqual({
      sourceIdentifier: "s-badplatser",
      geoJson: GEOJSON,
      mapping: BATHING_MAPPING,
      links: [],
      kept: [],
    });
    expect(within(group("Might already exist: decide for each")).getByText("Almenäs badplats")).toBeInTheDocument();
    expect(linkButton()).toHaveAttribute("aria-pressed", "true");
    expect(within(group("Changed since the last import")).getByText("Asklanda badplats")).toBeInTheDocument();
    expect(screen.queryByText("Dalsjön badplats")).not.toBeInTheDocument();
    expect(screen.getByText("replaces our text")).toBeInTheDocument();
  });

  it("sums up the earlier steps, each with a way back", async () => {
    await previewBoras();

    expect(screen.getByText("Borås · Badplatser")).toBeInTheDocument();
    expect(screen.getByText("anlaggningar.geojson · 1 point")).toBeInTheDocument();
    expect(screen.getByText("Name from name · id from place_id · all Swimming area")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Change fields" }));
    await userEvent.selectOptions(screen.getByLabelText("Description (optional)"), "None");
    await userEvent.click(compareButton());

    await waitFor(() => expect(calls(PREVIEW)).toHaveLength(2));
    expect(calls(PREVIEW)[1]?.body).toMatchObject({ mapping: { descriptionField: null } });
  });

  it("counts a place that joins one of ours as linked, not new", async () => {
    await previewBoras();

    expect(screen.getByText("might already exist").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("linked").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("new").previousElementSibling).toHaveTextContent("0");
    expect(within(rowOf("Almenäs badplats")).getByText("Link")).toBeInTheDocument();
  });

  it("previews again when a twin is created new, so the changes shown are the ones saved", async () => {
    await previewBoras();

    await userEvent.click(createButton());

    await waitFor(() => expect(calls(PREVIEW)).toHaveLength(2));
    expect(calls(PREVIEW)[1]?.body).toEqual({
      sourceIdentifier: "s-badplatser",
      geoJson: GEOJSON,
      mapping: BATHING_MAPPING,
      links: [{ sourceId: ALMENAS, facilityIdentifier: null }],
      kept: [],
    });
    await waitFor(() => expect(createButton()).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByText("new").previousElementSibling).toHaveTextContent("1");
  });

  it("lets a new place be linked by hand, offering only facilities of its type", async () => {
    suggest = false;
    await previewBoras();

    const row = within(group("New places"));
    expect(row.getByRole("option", { name: "Link to Almenäs" })).toBeInTheDocument();
    expect(row.queryByRole("option", { name: /Almenäsgrillen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link to ours" })).not.toBeInTheDocument();
  });

  it("does not link a twin to a facility another place has taken", async () => {
    extraRows = [
      {
        sourceId: "boras-badplatser:1490-6475",
        name: "Almenäs norra",
        kind: "New",
        facilityType: SWIMMING,
        facilityIdentifier: null,
        facilityName: null,
        suggestedFacilityIdentifier: null,
        suggestedFacilityName: null,
        changes: [],
      },
    ];
    await previewBoras();

    await userEvent.click(createButton());
    await waitFor(() => expect(createButton()).toHaveAttribute("aria-pressed", "true"));
    await userEvent.selectOptions(screen.getByLabelText("Import as"), "Link to Almenäs");

    await waitFor(() => expect(screen.getByLabelText("Import as")).toHaveValue("mock-almenas"));
    expect(linkButton()).toBeDisabled();
  });

  it("lists what the server adjusted to store the file", async () => {
    notes = ['The link of Almenäs badplats is left out: "www.boras.se" is not a full web address.'];

    await previewBoras();

    expect(screen.getByText("Adjusted to fit")).toBeInTheDocument();
    expect(screen.getByText(notes[0] ?? "")).toBeInTheDocument();
  });

  it("offers to keep only a value we hold, and nothing on a place that becomes new", async () => {
    await previewBoras();

    expect(screen.getByLabelText("Keep our name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Keep our position")).not.toBeInTheDocument();

    await userEvent.click(createButton());

    await waitFor(() => expect(screen.queryByLabelText("Keep our name")).not.toBeInTheDocument());
  });

  it("shows a keep at once and holds back saving while the server re-plans", async () => {
    await previewBoras();
    let answer: () => void = () => {};
    api.mock.on(
      "POST",
      PREVIEW,
      (body) =>
        new Promise((resolve) => {
          answer = () => resolve(previewFor(body as FacilityImportRequest));
        }),
    );

    await userEvent.click(screen.getByLabelText("Keep our description"));

    expect(screen.getByLabelText("Keep our description")).toBeChecked();
    expect(screen.getByLabelText("Keep our name")).toBeEnabled();
    expect(createButton()).toBeEnabled();
    expect(saveButton()).toBeDisabled();

    answer();

    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(screen.getByLabelText("Keep our description")).toBeChecked();
  });
});

describe("FacilityImportPanel, saving", () => {
  it("says what saving does, sends the suggestions without restating them and ends on a summary", async () => {
    await previewBoras();

    const asked = await save();

    expect(asked).toContain("0 new facilities are created");
    expect(asked).toContain("1 is linked to facilities we already have");
    expect(asked).toContain("Nothing is deleted.");
    await screen.findByRole("heading", { name: "Imported" });
    expect(calls(APPLY)[0]?.body).toEqual({
      sourceIdentifier: "s-badplatser",
      geoJson: GEOJSON,
      mapping: BATHING_MAPPING,
      links: [],
      kept: [],
    });
    expect(
      screen.getByText(/0 new, 1 linked to facilities we had and 1 updated, from Badplatser in Borås/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open them in Facilities" })).toHaveAttribute(
      "href",
      "/facilities?source=boras-badplatser",
    );
  });

  it("saves with our text kept when asked to", async () => {
    await previewBoras();

    await userEvent.click(screen.getByLabelText("Keep our description"));
    await waitFor(() => expect(calls(PREVIEW)).toHaveLength(2));
    expect(calls(PREVIEW)[1]?.body).toMatchObject({
      kept: [{ sourceId: "boras-badplatser:1490-6473", field: "Description" }],
    });
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(screen.getByText("replaces your edit")).toHaveClass("invisible");

    await save();

    await waitFor(() => expect(calls(APPLY)).toHaveLength(1));
    expect(calls(APPLY)[0]?.body).toMatchObject({
      kept: [{ sourceId: "boras-badplatser:1490-6473", field: "Description" }],
    });
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    await previewBoras();

    await userEvent.click(saveButton());
    await answerConfirm("no");

    expect(calls(APPLY)).toHaveLength(0);
    expect(saveButton()).toBeInTheDocument();
  });

  it("offers nothing to save when the server has no work", async () => {
    hasWork = false;

    await previewBoras();

    expect(screen.getByText("Everything is up to date.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Already imported");
    expect(saveButton()).toBeDisabled();
  });

  it("says what saving does when only the baseline is refreshed", async () => {
    allUnchanged = true;
    await previewBoras();
    expect(screen.getByRole("button", { name: "Show 3 unchanged" })).toBeInTheDocument();

    await userEvent.click(saveButton());
    const asked = await answerConfirm("no");

    expect(asked).toContain("saved as the baseline");
  });

  it("starts another file from the same data source", async () => {
    await previewBoras();
    await save();
    await screen.findByRole("heading", { name: "Imported" });

    await userEvent.click(screen.getByRole("button", { name: "Import another file" }));

    expect(screen.getByText("Choose a file to continue.")).toBeInTheDocument();
    expect(screen.getByText("Borås · Badplatser")).toBeInTheDocument();
  });
});
