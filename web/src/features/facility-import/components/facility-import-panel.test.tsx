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
let notes: string[] = [];
let municipalities: MunicipalityResponse[] = [];
let sources: FacilityImportSourceResponse[] = [];

// keep-comment: answers like the server: a row without a choice takes its suggestion, null creates a new one, kept fields are marked
function previewFor(request: FacilityImportRequest): FacilityImportPreviewResponse {
  const chosen = new Map((request.links ?? []).map((link) => [link.sourceId, link.facilityIdentifier ?? null]));
  const kept = new Set((request.kept ?? []).map((keep) => `${keep.sourceId}/${keep.field}`));

  return {
    source: sources.find((s) => s.identifier === request.sourceIdentifier)?.key ?? "",
    rows: rows.map((row) => {
      if (allUnchanged) return { ...row, kind: "Unchanged", changes: [] };
      const changes = row.changes.map((change) => ({ ...change, kept: kept.has(`${row.sourceId}/${change.field}`) }));
      return row.kind === "New" && chosen.has(row.sourceId)
        ? { ...row, changes, facilityIdentifier: chosen.get(row.sourceId) ?? null }
        : { ...row, changes };
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
const previewButton = () => screen.getByRole("button", { name: "Preview" });
const applyButton = () => screen.getByRole("button", { name: "Apply import" });

function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest("li");
  if (!row) throw new Error(`expected a row for ${name}`);
  return row;
}

async function chooseFile(content = GEOJSON) {
  await userEvent.upload(
    screen.getByLabelText("File"),
    new File([content], "anlaggningar.geojson", { type: "application/geo+json" }),
  );
}

async function choose(label: string, name: string) {
  await screen.findByRole("option", { name });
  await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled());
  await userEvent.selectOptions(screen.getByLabelText(label), name);
}

async function chooseBadplatser() {
  await choose("Municipality", "Borås");
  await choose("Data source", "Badplatser");
}

async function addSource(name: string) {
  await choose("Municipality", "Borås");
  await choose("Data source", "Add a data source…");
  await userEvent.type(screen.getByLabelText("New data source"), name);
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  await waitFor(() => expect(screen.getByLabelText("Data source")).not.toHaveValue(""));
}

async function previewBoras() {
  renderWithProviders(<FacilityImportPanel />);
  await chooseBadplatser();
  await chooseFile();
  await userEvent.click(previewButton());
  await screen.findByText("Almenäs badplats");
}

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  hasWork = true;
  allUnchanged = false;
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

describe("FacilityImportPanel", () => {
  it("asks for a municipality, a data source and a file before previewing", async () => {
    renderWithProviders(<FacilityImportPanel />);

    expect(previewButton()).toBeDisabled();
    expect(screen.getByText("Choose a municipality to preview.")).toBeInTheDocument();
    await choose("Municipality", "Borås");
    expect(screen.getByText("Choose a data source to preview.")).toBeInTheDocument();
    await choose("Data source", "Badplatser");
    expect(screen.getByText("Choose a file to preview.")).toBeInTheDocument();
    await chooseFile();

    expect(screen.getByText("anlaggningar.geojson")).toBeInTheDocument();
    await waitFor(() => expect(previewButton()).toBeEnabled());
    expect(screen.queryByText(/to preview\./)).not.toBeInTheDocument();
    expect(calls(PREVIEW)).toHaveLength(0);
  });

  it("adds a municipality from the list and picks it", async () => {
    renderWithProviders(<FacilityImportPanel />);

    await choose("Municipality", "Add a municipality…");
    await userEvent.type(screen.getByLabelText("New municipality"), "Ulricehamn");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(screen.getByLabelText("Municipality")).toHaveValue("m-ulricehamn"));
    expect(calls(MUNICIPALITIES)[0]?.body).toEqual({ name: "Ulricehamn" });
    expect(screen.getByText("Choose a data source to preview.")).toBeInTheDocument();
  });

  it("lists only the chosen municipality's data sources", async () => {
    sources = [BADPLATSER, { ...BADPLATSER, identifier: "s-mark", name: "Markbad", municipalityIdentifier: "m-mark" }];
    renderWithProviders(<FacilityImportPanel />);

    await choose("Municipality", "Borås");

    expect(screen.getByRole("option", { name: "Badplatser" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Markbad" })).not.toBeInTheDocument();
  });

  it("adds a data source under the municipality and picks it", async () => {
    renderWithProviders(<FacilityImportPanel />);

    await addSource("Grillplatser");

    expect(calls(SOURCES)[0]?.body).toEqual({ municipalityIdentifier: "m-boras", name: "Grillplatser" });
    expect(screen.getByLabelText("Data source")).toHaveValue("s-grillplatser");
  });

  it("previews the file with the data source's saved fields and hides the unchanged rows", async () => {
    await previewBoras();

    expect(calls(PREVIEW)[0]?.body).toEqual({
      sourceIdentifier: "s-badplatser",
      geoJson: GEOJSON,
      mapping: BATHING_MAPPING,
      links: [],
      kept: [],
    });
    expect(screen.getByText("Asklanda badplats")).toBeInTheDocument();
    expect(screen.queryByText("Dalsjön badplats")).not.toBeInTheDocument();
    expect(screen.getByText("replaces your edit")).toBeInTheDocument();
    expect(screen.getByLabelText("Import as")).toHaveValue("mock-almenas");
  });

  it("offers to link only facilities of the row's type", async () => {
    await previewBoras();

    expect(screen.getByRole("option", { name: /Link to Almenäs/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Almenäsgrillen/ })).not.toBeInTheDocument();
  });

  it("guesses a new data source's fields and maps each type value", async () => {
    renderWithProviders(<FacilityImportPanel />);
    await addSource("Grillplatser");
    await chooseFile(OUTDOOR);

    await screen.findByText(/3 points in the file/);
    expect(screen.getByLabelText("Name")).toHaveValue("namn");
    expect(screen.getByLabelText("Id")).toHaveValue("");
    expect(screen.getByLabelText("Facility type from")).toHaveValue("typ");
    expect(screen.getByLabelText("Grillplats")).toHaveValue("1");
    expect(screen.getByLabelText("Vindskydd")).toHaveValue("2");
    expect(screen.getByLabelText("Toalett")).toHaveValue("0");

    await userEvent.click(previewButton());

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

  it("lists what the server adjusted to store the file", async () => {
    notes = ['The link of Almenäs badplats is left out: "www.boras.se" is not a full web address.'];

    await previewBoras();

    expect(screen.getByText("Adjusted to fit")).toBeInTheDocument();
    expect(screen.getByText(notes[0] ?? "")).toBeInTheDocument();
  });

  it("keeps a data source's id field and says when the file lacks it", async () => {
    renderWithProviders(<FacilityImportPanel />);
    await chooseBadplatser();

    await chooseFile(fileOf(feature({ id: "1", name: "Almenäs badplats" })));

    expect(await screen.findByText(/The file has no place_id/)).toBeInTheDocument();
    expect(screen.getByLabelText("Id")).toHaveValue("place_id");
    expect(screen.getByLabelText("Id")).toBeDisabled();
    expect(previewButton()).toBeDisabled();
  });

  it("lets points without a type value be given a type or left out", async () => {
    renderWithProviders(<FacilityImportPanel />);
    await addSource("Grillplatser");

    await chooseFile(fileOf(feature({ namn: "Grillen", typ: "Grillplats" }), feature({ namn: "Okänd" })));

    expect(await screen.findByLabelText("(no value)")).toHaveValue("0");
    await userEvent.click(previewButton());
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

  it("keeps the newest file when an earlier one finishes reading last", async () => {
    renderWithProviders(<FacilityImportPanel />);
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
    await waitFor(() => expect(previewButton()).toBeEnabled());
    await act(async () => {
      finishFirst("not json");
      await Promise.resolve();
    });

    expect(previewButton()).toBeEnabled();
    expect(screen.queryByText("Reading the file…")).not.toBeInTheDocument();
  });

  it("asks for a facility type when the file has no type field", async () => {
    renderWithProviders(<FacilityImportPanel />);
    await addSource("Bad");
    await chooseFile();

    expect(await screen.findByText("Choose a facility type for the file.")).toBeInTheDocument();
    expect(previewButton()).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText("Facility type"), "Swimming area");

    expect(previewButton()).toBeEnabled();
  });

  it("says why a file cannot be read", async () => {
    renderWithProviders(<FacilityImportPanel />);
    await chooseBadplatser();

    await chooseFile("not json");

    expect(await screen.findByRole("alert")).toHaveTextContent("The file is not valid GeoJSON.");
    expect(previewButton()).toBeDisabled();
  });

  it("counts and marks a row joining an existing facility as linked, not new", async () => {
    await previewBoras();

    expect(screen.getByText("linked").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("new").previousElementSibling).toHaveTextContent("0");
    const almenas = within(rowOf("Almenäs badplats"));
    expect(almenas.getByText("Link")).toBeInTheDocument();
    expect(almenas.queryByText("New")).not.toBeInTheDocument();
  });

  it("previews again with the new choice so the changes shown are the ones applied", async () => {
    await previewBoras();

    await userEvent.selectOptions(screen.getByLabelText("Import as"), "A new facility");

    await waitFor(() => expect(calls(PREVIEW)).toHaveLength(2));
    expect(calls(PREVIEW)[1]?.body).toEqual({
      sourceIdentifier: "s-badplatser",
      geoJson: GEOJSON,
      mapping: BATHING_MAPPING,
      links: [{ sourceId: ALMENAS, facilityIdentifier: null }],
      kept: [],
    });
    await waitFor(() => expect(screen.getByLabelText("Import as")).toHaveValue(""));
  });

  it("applies the suggestions shown without restating them, then previews again", async () => {
    await previewBoras();

    await userEvent.click(applyButton());
    const asked = await answerConfirm("yes");

    expect(asked).toContain("0 created, 1 linked");
    await waitFor(() => expect(calls(APPLY)).toHaveLength(1));
    expect(calls(APPLY)[0]?.body).toEqual({
      sourceIdentifier: "s-badplatser",
      geoJson: GEOJSON,
      mapping: BATHING_MAPPING,
      links: [],
      kept: [],
    });
    await waitFor(() => expect(calls(PREVIEW)).toHaveLength(2));
  });

  it("keeps our text when asked to, and applies with it kept", async () => {
    await previewBoras();

    await userEvent.click(screen.getByLabelText("Keep our description"));

    await waitFor(() => expect(calls(PREVIEW)).toHaveLength(2));
    expect(calls(PREVIEW)[1]?.body).toMatchObject({
      kept: [{ sourceId: "boras-badplatser:1490-6473", field: "Description" }],
    });
    await waitFor(() => expect(screen.getByLabelText("Keep our description")).toBeChecked());
    expect(screen.getByText("replaces your edit")).toHaveClass("invisible");

    await userEvent.click(applyButton());
    await answerConfirm("yes");

    await waitFor(() => expect(calls(APPLY)).toHaveLength(1));
    expect(calls(APPLY)[0]?.body).toMatchObject({
      kept: [{ sourceId: "boras-badplatser:1490-6473", field: "Description" }],
    });
  });

  it("shows a keep at once and leaves the page usable while the server re-plans", async () => {
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
    expect(screen.getByLabelText("Import as")).toBeEnabled();
    expect(previewButton()).toBeEnabled();
    expect(applyButton()).toBeDisabled();

    answer();

    await waitFor(() => expect(applyButton()).toBeEnabled());
    expect(screen.getByLabelText("Keep our description")).toBeChecked();
  });

  it("offers to keep only a value we hold, and nothing on a row that creates a facility", async () => {
    await previewBoras();

    expect(screen.getByLabelText("Keep our name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Keep our position")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Import as"), "A new facility");

    await waitFor(() => expect(screen.getByLabelText("Import as")).toHaveValue(""));
    expect(screen.queryByLabelText("Keep our name")).not.toBeInTheDocument();
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    await previewBoras();

    await userEvent.click(applyButton());
    await answerConfirm("no");

    expect(calls(APPLY)).toHaveLength(0);
  });

  it("offers nothing to apply when the server has no work", async () => {
    hasWork = false;

    await previewBoras();

    expect(screen.getByText("Everything is up to date.")).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();
  });

  it("drops the review when another file is chosen", async () => {
    await previewBoras();

    await chooseFile(OUTDOOR);

    expect(screen.queryByText("Almenäs badplats")).not.toBeInTheDocument();
  });

  it("drops the review when a field is changed", async () => {
    await previewBoras();

    await userEvent.selectOptions(screen.getByLabelText("Description"), "None");

    expect(screen.queryByText("Almenäs badplats")).not.toBeInTheDocument();
  });

  it("shows the server's reason once when the preview is refused", async () => {
    const reason = "The file uses the coordinate system EPSG:3006. Export it as WGS84 (EPSG:4326).";
    api.mock.on("POST", PREVIEW, () => {
      throw new ApiError(reason, 400);
    });
    renderWithProviders(<FacilityImportPanel />);
    await chooseBadplatser();
    await chooseFile();

    await waitFor(() => expect(previewButton()).toBeEnabled());
    await userEvent.click(previewButton());

    await waitFor(() => expect(toasts.error).toHaveBeenCalledExactlyOnceWith(reason));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has no municipality chosen while a new one is being added", async () => {
    renderWithProviders(<FacilityImportPanel />);
    await chooseBadplatser();
    await chooseFile();

    await choose("Municipality", "Add a municipality…");

    expect(previewButton()).toBeDisabled();
  });

  it("says what applying does when only the baseline is refreshed", async () => {
    allUnchanged = true;
    renderWithProviders(<FacilityImportPanel />);
    await chooseBadplatser();
    await chooseFile();
    await waitFor(() => expect(previewButton()).toBeEnabled());
    await userEvent.click(previewButton());
    await screen.findByRole("button", { name: "Show 3 unchanged" });

    await userEvent.click(applyButton());
    const asked = await answerConfirm("no");

    expect(asked).toContain("saved as the baseline");
  });
});
