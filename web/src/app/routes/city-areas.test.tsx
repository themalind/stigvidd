// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminCityAreaResponse, AdminFacilityResponse } from "@/api/generated/model";
import { ApiError } from "@/api/mutator";
import { QueryBoundary } from "@/components/query-boundary";
import { toBoundary, toFeatures } from "@/features/city-areas/hooks/use-boundary-editor";
import { maps } from "@/testing/fake-maplibre";
import { draws } from "@/testing/fake-terra-draw";
import { renderWithProviders } from "@/testing/render";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const toasts = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => toasts);
vi.mock("maplibre-gl", () => import("@/testing/fake-maplibre"));
vi.mock("terra-draw", () => import("@/testing/fake-terra-draw"));
vi.mock("terra-draw-maplibre-gl-adapter", () => import("@/testing/fake-terra-draw"));

import CityAreasPage from "./city-areas";

const AREAS = "/api/v1/admin/city-areas";
const NO_CHANGES = { addedTrails: [], removedTrails: [], addedFacilities: [], removedFacilities: [] };
const FACILITIES = "/api/v1/admin/facilities";

function facility(overrides: Partial<AdminFacilityResponse>): AdminFacilityResponse {
  return {
    identifier: "f-1",
    name: "Grillplats Rya",
    facilityType: 1,
    isAccessible: false,
    latitude: 57.74,
    longitude: 12.94,
    location: "Vid parkeringen",
    description: "",
    url: "",
    ...overrides,
  };
}

function seed() {
  api.mock.on("GET", AREAS, () => [
    {
      identifier: "a-1",
      name: "Rya åsar",
      location: "Norr om Borås",
      boundary: null,
      facilities: [{ identifier: "f-1", name: "Grillplats Rya", facilityType: 1, isManual: true }],
      trails: [],
      excludedFacilities: [],
      excludedTrails: [],
    },
    {
      identifier: "a-2",
      name: "Öresjö",
      location: "Öster om Borås",
      boundary: null,
      facilities: [],
      trails: [],
      excludedFacilities: [],
      excludedTrails: [],
    },
  ]);
  api.mock.on("GET", "/api/v1/admin/municipalities", () => [{ identifier: "m-boras", name: "Borås", slug: "boras" }]);
  api.mock.on("GET", `${AREAS}/a-1/trail-paths`, () => []);
  api.mock.on("POST", `${AREAS}/a-1/boundary-preview`, () => NO_CHANGES);
  api.mock.on("GET", `${AREAS}/a-2/trail-paths`, () => []);
  api.mock.on("GET", FACILITIES, () => [
    facility({ identifier: "f-1", name: "Grillplats Rya", facilityType: 1, isAccessible: true }),
    facility({ identifier: "f-2", name: "Vindskydd Rya", facilityType: 2, latitude: null, longitude: null }),
  ]);
  api.mock.on("GET", "/api/v1/admin/trails", () => [
    {
      identifier: "t-1",
      name: "Ryaslingan",
      trailLength: 4,
      accessibility: true,
      classification: 1,
      city: "Borås",
      isVerified: false,
      hasImages: false,
      hasExampleImages: false,
      hasSymbol: false,
      hasDescription: false,
      hasFullDescription: false,
      createdAt: "2026-01-01T00:00:00Z",
      lastUpdatedAt: "2026-01-01T00:00:00Z",
    },
  ]);
}

function renderPage() {
  return renderWithProviders(
    <QueryBoundary>
      <CityAreasPage />
    </QueryBoundary>,
    { initialEntries: ["/areas"] },
  );
}

function facilitiesCard() {
  const card = screen.getByText("Facilities").closest<HTMLElement>("[data-slot=card]");
  if (!card) throw new Error("expected the Facilities card");
  return within(card);
}

beforeEach(() => {
  api.mock.reset();
  vi.clearAllMocks();
  seed();
});

describe("CityAreasPage", () => {
  it("shows the first area with what is linked to it", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Rya åsar" })).toBeInTheDocument();
    expect(facilitiesCard().getByText("Grillplats Rya")).toBeInTheDocument();
  });

  it("links a facility at once, before the server has answered", async () => {
    let answer: (value: unknown) => void = () => {};
    api.mock.on("PUT", `${AREAS}/a-1/facilities/f-2`, () => new Promise((resolve) => (answer = resolve)));
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.type(screen.getByRole("textbox", { name: "Search facilities to link" }), "vindskydd");
    await userEvent.click(screen.getByRole("button", { name: "Link Vindskydd Rya" }));

    expect(facilitiesCard().getByRole("button", { name: "Unlink Vindskydd Rya" })).toBeInTheDocument();
    expect(api.mock.calls).toContainEqual(
      expect.objectContaining({ method: "PUT", path: `${AREAS}/a-1/facilities/f-2`, body: undefined }),
    );
    answer(undefined);
  });

  it("puts a refused unlink back without waiting for the list to reload", async () => {
    api.mock.on("DELETE", `${AREAS}/a-1/facilities/f-1`, () => {
      throw new ApiError("Not allowed", 403);
    });
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });
    api.mock.on("GET", AREAS, () => new Promise(() => {}));

    await userEvent.click(screen.getByRole("button", { name: "Unlink Grillplats Rya" }));

    expect(await facilitiesCard().findByRole("button", { name: "Unlink Grillplats Rya" })).toBeInTheDocument();
  });

  it("marks an inactive trail when offering it", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.type(screen.getByRole("textbox", { name: "Search trails to link" }), "rya");

    expect(screen.getByText("Borås · inactive")).toBeInTheDocument();
  });

  it("says when a search only finds what is already linked", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.type(screen.getByRole("textbox", { name: "Search facilities to link" }), "grillplats");

    expect(facilitiesCard().getByText("Already linked here: Grillplats Rya")).toBeInTheDocument();
    expect(facilitiesCard().queryByText("No matches.")).not.toBeInTheDocument();
  });

  it("finds a trail by its words in any order", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.type(screen.getByRole("textbox", { name: "Search trails to link" }), "Boras Ryaslingan");

    expect(screen.getByRole("button", { name: "Link Ryaslingan" })).toBeInTheDocument();
  });
});

describe("choosing an area", () => {
  it("lists the areas only once the picker is opened", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    expect(screen.queryByRole("list", { name: "Areas" })).not.toBeInTheDocument();
  });

  it("finds an area by search, ignoring accents", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.click(screen.getByRole("combobox", { name: /Rya åsar/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "Search areas" }), "oresjo");
    const list = within(screen.getByRole("list", { name: "Areas" }));
    expect(list.queryByText("Rya åsar")).not.toBeInTheDocument();
    await userEvent.click(list.getByText("Öresjö"));

    expect(await screen.findByRole("heading", { name: "Öresjö" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Areas" })).not.toBeInTheDocument();
  });
});

describe("linking what is not in an area", () => {
  beforeEach(() => {
    api.mock.on("GET", `${AREAS}/suggestions`, () => ({
      facilities: [
        {
          identifier: "f-3",
          name: "Grillplats Öresjö",
          facilityType: 1,
          suggestions: [
            { areaIdentifier: "a-2", areaName: "Öresjö", reason: "Name", distanceKm: null, nearestName: null },
          ],
        },
        { identifier: "f-4", name: "Vindskydd Okänd", facilityType: 2, suggestions: [] },
      ],
      trails: [
        {
          identifier: "t-2",
          name: "Kråkstigen",
          city: "Kråkered",
          isVerified: true,
          suggestions: [
            {
              areaIdentifier: "a-1",
              areaName: "Rya åsar",
              reason: "Nearby",
              distanceKm: 1.2,
              nearestName: "Ryaslingan",
            },
            {
              areaIdentifier: "a-2",
              areaName: "Öresjö",
              reason: "Nearby",
              distanceKm: 3.4,
              nearestName: "Öresjö runt",
            },
          ],
        },
      ],
    }));
  });

  async function openUnlinked() {
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "Not in an area" }));
    return {
      facilities: within(await screen.findByRole("list", { name: "Facilities" })),
      trails: within(screen.getByRole("list", { name: "Trails" })),
    };
  }

  function suggestionLoads() {
    return api.mock.calls.filter((call) => call.method === "GET" && call.path === `${AREAS}/suggestions`).length;
  }

  function areasFor(label: string) {
    return within(screen.getByRole("group", { name: `Areas for ${label}` }));
  }

  it("offers every suggested area with its reason, the first one ticked", async () => {
    const { facilities } = await openUnlinked();

    expect(areasFor("Kråkstigen").getByRole("button", { name: "Rya åsar, 1.2 km" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(areasFor("Kråkstigen").getByRole("button", { name: "Öresjö, 3.4 km" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(areasFor("Grillplats Öresjö").getByRole("button", { name: "Öresjö, name" })).toBeInTheDocument();
    expect(facilities.getByText("Shelter · No area within 5 km")).toBeInTheDocument();
  });

  it("links a trail to two suggested areas in one go", async () => {
    api.mock.on("PUT", `${AREAS}/a-1/trails/t-2`, () => undefined);
    api.mock.on("PUT", `${AREAS}/a-2/trails/t-2`, () => undefined);
    await openUnlinked();

    await userEvent.click(areasFor("Kråkstigen").getByRole("button", { name: "Öresjö, 3.4 km" }));
    await userEvent.click(
      areasFor("Kråkstigen").getByRole("button", { name: "Link Kråkstigen to Rya åsar and Öresjö" }),
    );

    const linked = api.mock.calls.filter((call) => call.method === "PUT").map((call) => call.path);
    expect(linked).toEqual(expect.arrayContaining([`${AREAS}/a-1/trails/t-2`, `${AREAS}/a-2/trails/t-2`]));
    expect(linked).toHaveLength(2);
  });

  it("will not link until an area is chosen", async () => {
    await openUnlinked();

    expect(areasFor("Vindskydd Okänd").getByRole("button", { name: "Link Vindskydd Okänd" })).toBeDisabled();
  });

  it("links to the suggested area and drops the row at once", async () => {
    let answer: (value: unknown) => void = () => {};
    api.mock.on("PUT", `${AREAS}/a-2/facilities/f-3`, () => new Promise((resolve) => (answer = resolve)));
    const { facilities } = await openUnlinked();

    await userEvent.click(facilities.getByRole("button", { name: "Link Grillplats Öresjö to Öresjö" }));

    expect(facilities.queryByText("Grillplats Öresjö")).not.toBeInTheDocument();
    expect(api.mock.calls).toContainEqual(
      expect.objectContaining({ method: "PUT", path: `${AREAS}/a-2/facilities/f-3` }),
    );
    answer(undefined);
  });

  it("links to areas ticked in the search, which stays open for more", async () => {
    api.mock.on("PUT", `${AREAS}/a-1/facilities/f-4`, () => undefined);
    api.mock.on("PUT", `${AREAS}/a-2/facilities/f-4`, () => undefined);
    await openUnlinked();

    await userEvent.click(
      areasFor("Vindskydd Okänd").getByRole("button", { name: "Choose areas for Vindskydd Okänd" }),
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Search areas" }), "oresjo");
    await userEvent.click(within(screen.getByRole("list", { name: "Areas" })).getByText("Öresjö"));
    await userEvent.clear(screen.getByRole("textbox", { name: "Search areas" }));
    await userEvent.click(within(screen.getByRole("list", { name: "Areas" })).getByText("Rya åsar"));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      areasFor("Vindskydd Okänd").getByRole("button", { name: "Link Vindskydd Okänd to Öresjö and Rya åsar" }),
    );

    const linked = api.mock.calls.filter((call) => call.method === "PUT").map((call) => call.path);
    expect(linked).toEqual(expect.arrayContaining([`${AREAS}/a-1/facilities/f-4`, `${AREAS}/a-2/facilities/f-4`]));
  });

  it("puts a refused link back", async () => {
    api.mock.on("PUT", `${AREAS}/a-1/trails/t-2`, () => {
      throw new ApiError("Not allowed", 403);
    });
    const { trails } = await openUnlinked();
    api.mock.on("GET", `${AREAS}/suggestions`, () => new Promise(() => {}));

    await userEvent.click(trails.getByRole("button", { name: "Link Kråkstigen to Rya åsar" }));

    expect(await trails.findByText("Kråkstigen")).toBeInTheDocument();
    expect(toasts.toast.error).toHaveBeenCalled();
  });

  it("narrows the facilities to one type", async () => {
    const { facilities } = await openUnlinked();

    await userEvent.click(screen.getByRole("button", { name: "Shelter" }));

    expect(facilities.queryByText("Grillplats Öresjö")).not.toBeInTheDocument();
    expect(facilities.getByText("Vindskydd Okänd")).toBeInTheDocument();
  });

  it("shows every type again once the filtered type is all linked", async () => {
    api.mock.on("PUT", `${AREAS}/a-1/facilities/f-4`, () => undefined);
    await openUnlinked();
    await userEvent.click(screen.getByRole("button", { name: "Shelter" }));
    api.mock.on("GET", `${AREAS}/suggestions`, () => ({
      facilities: [
        {
          identifier: "f-3",
          name: "Grillplats Öresjö",
          facilityType: 1,
          suggestions: [
            { areaIdentifier: "a-2", areaName: "Öresjö", reason: "Name", distanceKm: null, nearestName: null },
          ],
        },
      ],
      trails: [],
    }));

    await userEvent.click(
      areasFor("Vindskydd Okänd").getByRole("button", { name: "Choose areas for Vindskydd Okänd" }),
    );
    await userEvent.click(within(screen.getByRole("list", { name: "Areas" })).getByText("Rya åsar"));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(
      areasFor("Vindskydd Okänd").getByRole("button", { name: "Link Vindskydd Okänd to Rya åsar" }),
    );

    expect(await screen.findByText("Grillplats Öresjö")).toBeInTheDocument();
  });

  it("keeps a linked row away while another link is still on its way", async () => {
    let slow: (value: unknown) => void = () => {};
    api.mock.on("PUT", `${AREAS}/a-2/facilities/f-3`, () => new Promise((resolve) => (slow = resolve)));
    api.mock.on("PUT", `${AREAS}/a-1/trails/t-2`, () => undefined);
    const { facilities } = await openUnlinked();

    await userEvent.click(
      areasFor("Grillplats Öresjö").getByRole("button", { name: "Link Grillplats Öresjö to Öresjö" }),
    );
    await userEvent.click(areasFor("Kråkstigen").getByRole("button", { name: "Link Kråkstigen to Rya åsar" }));
    await act(async () => {});

    expect(suggestionLoads()).toBe(1);
    expect(facilities.queryByText("Grillplats Öresjö")).not.toBeInTheDocument();

    api.mock.on("GET", `${AREAS}/suggestions`, () => ({ facilities: [], trails: [] }));
    slow(undefined);
    await waitFor(() => expect(suggestionLoads()).toBe(2));
  });
});

describe("editing a facility", () => {
  async function openEditor() {
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });
    await userEvent.click(facilitiesCard().getByRole("button", { name: "Edit Grillplats Rya" }));
    return within(await screen.findByRole("dialog"));
  }

  it("sends the whole facility with the new description", async () => {
    api.mock.on("PUT", `${FACILITIES}/f-1`, (body) => ({ ...facility({}), ...(body as object) }));
    const dialog = await openEditor();

    await userEvent.type(dialog.getByRole("textbox", { name: "Description" }), "Ved finns i boden.");
    await userEvent.click(dialog.getByRole("button", { name: "Save changes" }));

    expect(api.mock.calls).toContainEqual(
      expect.objectContaining({
        method: "PUT",
        path: `${FACILITIES}/f-1`,
        body: {
          name: "Grillplats Rya",
          facilityType: 1,
          isAccessible: true,
          latitude: 57.74,
          longitude: 12.94,
          location: "Vid parkeringen",
          description: "Ved finns i boden.",
          url: "",
        },
      }),
    );
    expect(toasts.toast.success).toHaveBeenCalledWith("Facility saved.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("will not save half a coordinate pair", async () => {
    const dialog = await openEditor();

    await userEvent.clear(dialog.getByRole("textbox", { name: "Longitude" }));

    expect(dialog.getByRole("alert")).toHaveTextContent("Fill in both latitude and longitude, or neither.");
    expect(dialog.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("will not save a link that is not a web address", async () => {
    const dialog = await openEditor();

    await userEvent.type(dialog.getByRole("textbox", { name: "Link" }), "boras.se");

    expect(dialog.getByRole("alert")).toHaveTextContent("https://");
    expect(dialog.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("saves a facility without a point as null coordinates", async () => {
    api.mock.on("PUT", `${FACILITIES}/f-1`, (body) => ({ ...facility({}), ...(body as object) }));
    const dialog = await openEditor();

    await userEvent.clear(dialog.getByRole("textbox", { name: "Latitude" }));
    await userEvent.clear(dialog.getByRole("textbox", { name: "Longitude" }));
    await userEvent.click(dialog.getByRole("button", { name: "Save changes" }));

    expect(api.mock.calls).toContainEqual(
      expect.objectContaining({
        method: "PUT",
        body: expect.objectContaining({ latitude: null, longitude: null }),
      }),
    );
  });
});

const SQUARE = [
  [
    [
      [12.9, 57.7],
      [12.95, 57.7],
      [12.95, 57.75],
      [12.9, 57.7],
    ],
  ],
];

const AREA_A1: AdminCityAreaResponse = {
  identifier: "a-1",
  name: "Rya åsar",
  location: "Norr om Borås",
  municipalityIdentifier: null,
  boundary: null,
  facilities: [{ identifier: "f-1", name: "Grillplats Rya", facilityType: 1, isManual: true }],
  trails: [],
  excludedFacilities: [],
  excludedTrails: [],
};

function withArea(overrides: Record<string, unknown>) {
  api.mock.on("GET", AREAS, () => [{ ...AREA_A1, ...overrides }]);
}

describe("the municipality", () => {
  it("saves the chosen municipality for the area", async () => {
    api.mock.on("PUT", `${AREAS}/a-1/municipality`, () => undefined);
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await screen.findByRole("option", { name: "Borås" });
    await waitFor(() => expect(screen.getByLabelText("Municipality")).toBeEnabled());
    await userEvent.selectOptions(screen.getByLabelText("Municipality"), "Borås");

    await waitFor(() =>
      expect(api.mock.calls).toContainEqual(
        expect.objectContaining({
          method: "PUT",
          path: `${AREAS}/a-1/municipality`,
          body: { municipalityIdentifier: "m-boras" },
        }),
      ),
    );
  });

  it("shows the municipality the area already has", async () => {
    withArea({ municipalityIdentifier: "m-boras" });
    renderPage();
    await screen.findByRole("option", { name: "Borås" });

    expect(screen.getByLabelText("Municipality")).toHaveValue("m-boras");
  });

  it("clears the municipality when none is chosen", async () => {
    withArea({ municipalityIdentifier: "m-boras" });
    api.mock.on("PUT", `${AREAS}/a-1/municipality`, () => undefined);
    renderPage();
    await screen.findByRole("option", { name: "Borås" });
    await waitFor(() => expect(screen.getByLabelText("Municipality")).toBeEnabled());

    await userEvent.selectOptions(screen.getByLabelText("Municipality"), "No municipality");

    await waitFor(() =>
      expect(api.mock.calls).toContainEqual(
        expect.objectContaining({
          method: "PUT",
          path: `${AREAS}/a-1/municipality`,
          body: { municipalityIdentifier: null },
        }),
      ),
    );
  });

  it("saves nothing when adding a municipality starts or is cancelled", async () => {
    withArea({ municipalityIdentifier: "m-boras" });
    renderPage();
    await screen.findByRole("option", { name: "Borås" });
    await waitFor(() => expect(screen.getByLabelText("Municipality")).toBeEnabled());

    await userEvent.selectOptions(screen.getByLabelText("Municipality"), "Add a municipality…");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.mock.calls.filter((call) => call.method === "PUT")).toEqual([]);
    expect(screen.getByLabelText("Municipality")).toHaveValue("m-boras");
  });
});

describe("neighbouring areas", () => {
  function withNeighbour() {
    api.mock.on("GET", AREAS, () => [
      { ...AREA_A1, boundary: SQUARE },
      { ...AREA_A1, identifier: "a-2", name: "Öresjö", boundary: SQUARE },
      { ...AREA_A1, identifier: "a-3", name: "Utan yta", boundary: null },
    ]);
  }

  async function loadedMap() {
    const page = renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });
    const map = maps.at(-1);
    if (!map) throw new Error("expected a map");
    act(() => map.loadStyle());
    return { map, page };
  }

  it("draws the other areas' boundaries, but not the selected one or an area without one", async () => {
    withNeighbour();
    const { map } = await loadedMap();

    const neighbours = map.sources.neighbours as GeoJSON.FeatureCollection;
    expect(neighbours.features.map((feature) => feature.properties?.name)).toEqual(["Öresjö"]);
    expect(screen.getByText("Other areas")).toBeInTheDocument();
  });

  it("names each one in the middle of its boundary, whatever the map style", async () => {
    withNeighbour();
    const { map } = await loadedMap();

    expect(map.markers.map((marker) => marker.element.textContent)).toEqual(["Öresjö"]);
    expect(map.markers[0]?.position).toEqual([12.925, 57.725]);
  });

  it("takes the names off the map when it closes", async () => {
    withNeighbour();
    const { map, page } = await loadedMap();
    expect(map.markers).toHaveLength(1);

    page.unmount();
    expect(map.markers).toEqual([]);
  });
});

describe("the boundary", () => {
  it("saves a suggested boundary only once it is used", async () => {
    api.mock.on("GET", `${AREAS}/a-1/boundary-suggestion`, () => ({ coordinates: SQUARE }));
    api.mock.on("PUT", `${AREAS}/a-1/boundary`, () => undefined);
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.click(screen.getByRole("button", { name: "Suggest boundary from links" }));
    await screen.findByRole("button", { name: "Use suggestion" });
    expect(api.mock.calls.some((call) => call.method === "PUT")).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Use suggestion" }));

    await waitFor(() =>
      expect(api.mock.calls).toContainEqual(
        expect.objectContaining({ method: "PUT", path: `${AREAS}/a-1/boundary`, body: { coordinates: SQUARE } }),
      ),
    );
    expect(await screen.findByRole("button", { name: "Suggest boundary from links" })).toBeInTheDocument();
  });

  it("frames a suggestion once and leaves the map alone when a trail is linked", async () => {
    api.mock.on("GET", `${AREAS}/a-1/boundary-suggestion`, () => ({ coordinates: SQUARE }));
    api.mock.on("PUT", `${AREAS}/a-1/trails/t-1`, () => undefined);
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });
    await userEvent.click(screen.getByRole("button", { name: "Suggest boundary from links" }));
    await screen.findByRole("button", { name: "Use suggestion" });
    const map = maps.at(-1);
    if (!map) throw new Error("expected a map");
    const fits = map.fits;

    await userEvent.type(screen.getByRole("textbox", { name: "Search trails to link" }), "rya");
    await userEvent.click(screen.getByRole("button", { name: "Link Ryaslingan" }));

    await waitFor(() =>
      expect(api.mock.calls).toContainEqual(
        expect.objectContaining({ method: "PUT", path: `${AREAS}/a-1/trails/t-1` }),
      ),
    );
    expect(map.fits).toBe(fits);
  });

  it("shows what saving the suggestion would add and remove before anything is saved", async () => {
    api.mock.on("GET", `${AREAS}/a-1/boundary-suggestion`, () => ({ coordinates: SQUARE }));
    api.mock.on("POST", `${AREAS}/a-1/boundary-preview`, () => ({
      ...NO_CHANGES,
      addedTrails: [{ identifier: "t-9", name: "Stora slingan", shareInside: 0.27, path: [] }],
      removedFacilities: [{ identifier: "f-1", name: "Grillplats Rya", longitude: 12.94, latitude: 57.74 }],
    }));
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.click(screen.getByRole("button", { name: "Suggest boundary from links" }));

    const summary = await screen.findByLabelText("What saving changes");
    expect(within(summary).getByText("Stora slingan (27 % inside)")).toBeInTheDocument();
    expect(within(summary).getByText("Grillplats Rya")).toBeInTheDocument();
    expect(api.mock.calls).toContainEqual(
      expect.objectContaining({ method: "POST", path: `${AREAS}/a-1/boundary-preview`, body: { coordinates: SQUARE } }),
    );
    expect(api.mock.calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("says when saving changes nothing", async () => {
    api.mock.on("GET", `${AREAS}/a-1/boundary-suggestion`, () => ({ coordinates: SQUARE }));
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.click(screen.getByRole("button", { name: "Suggest boundary from links" }));

    expect(await screen.findByText("Saving this boundary changes nothing in the area.")).toBeInTheDocument();
  });

  it("drops a discarded suggestion without saving", async () => {
    api.mock.on("GET", `${AREAS}/a-1/boundary-suggestion`, () => ({ coordinates: SQUARE }));
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.click(screen.getByRole("button", { name: "Suggest boundary from links" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));

    expect(screen.getByRole("button", { name: "Suggest boundary from links" })).toBeInTheDocument();
    expect(api.mock.calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("says why there is nothing to suggest", async () => {
    api.mock.on("GET", `${AREAS}/a-1/boundary-suggestion`, () => {
      throw new ApiError("The city area has no linked trails or facilities", 404, "no_boundary_sources");
    });
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.click(screen.getByRole("button", { name: "Suggest boundary from links" }));

    await waitFor(() =>
      expect(toasts.toast.error).toHaveBeenCalledWith("The city area has no linked trails or facilities"),
    );
  });

  it("tells a link from the boundary from a manual one once there is a boundary", async () => {
    withArea({
      boundary: SQUARE,
      facilities: [
        { identifier: "f-1", name: "Grillplats Rya", facilityType: 1, isManual: false },
        { identifier: "f-2", name: "Vindskydd Rya", facilityType: 2, isManual: true },
      ],
    });
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    expect(facilitiesCard().getByText("Fire pit · from boundary")).toBeInTheDocument();
    expect(facilitiesCard().getByText("Shelter · manual")).toBeInTheDocument();
  });

  it("asks before removing the boundary", async () => {
    withArea({ boundary: SQUARE });
    api.mock.on("DELETE", `${AREAS}/a-1/boundary`, () => undefined);
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.click(screen.getByRole("button", { name: "Remove boundary" }));
    expect(api.mock.calls.some((call) => call.method === "DELETE")).toBe(false);
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove boundary" }),
    );

    await waitFor(() =>
      expect(api.mock.calls).toContainEqual(
        expect.objectContaining({ method: "DELETE", path: `${AREAS}/a-1/boundary` }),
      ),
    );
  });

  it("undoes a removed trail", async () => {
    withArea({
      boundary: SQUARE,
      excludedTrails: [{ identifier: "t-1", name: "Ryaslingan", isVerified: true, isManual: false }],
    });
    api.mock.on("DELETE", `${AREAS}/a-1/excluded-trails/t-1`, () => undefined);
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.click(screen.getByRole("button", { name: "Undo removing Ryaslingan" }));

    await waitFor(() =>
      expect(api.mock.calls).toContainEqual(
        expect.objectContaining({ method: "DELETE", path: `${AREAS}/a-1/excluded-trails/t-1` }),
      ),
    );
  });

  it("recalculates every area only after asking", async () => {
    api.mock.on("POST", `${AREAS}/recalculate`, () => ({ areaCount: 2 }));
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.click(screen.getByRole("button", { name: "Recalculate all areas" }));
    expect(api.mock.calls.some((call) => call.method === "POST")).toBe(false);
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Recalculate" }));

    await waitFor(() =>
      expect(api.mock.calls).toContainEqual(expect.objectContaining({ method: "POST", path: `${AREAS}/recalculate` })),
    );
  });
});

describe("editing the boundary on the map", () => {
  const MOVED = [
    [
      [12.9, 57.7],
      [12.99, 57.7],
      [12.99, 57.75],
      [12.9, 57.7],
    ],
  ];

  async function openEditor(button: string) {
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });
    act(() => maps.at(-1)?.loadStyle());
    await userEvent.click(screen.getByRole("button", { name: button }));
    const draw = draws.at(-1);
    if (!draw) throw new Error("expected the editor to start");
    return draw;
  }

  beforeEach(() => {
    draws.length = 0;
  });

  it("saves the suggestion as adjusted on the map", async () => {
    api.mock.on("GET", `${AREAS}/a-1/boundary-suggestion`, () => ({ coordinates: SQUARE }));
    api.mock.on("PUT", `${AREAS}/a-1/boundary`, () => undefined);
    renderPage();
    await screen.findByRole("heading", { name: "Rya åsar" });
    act(() => maps.at(-1)?.loadStyle());
    await userEvent.click(screen.getByRole("button", { name: "Suggest boundary from links" }));
    await userEvent.click(await screen.findByRole("button", { name: "Adjust on map" }));
    const draw = draws.at(-1);
    if (!draw) throw new Error("expected the editor to start");
    expect(toBoundary(draw.features)).toEqual(SQUARE);

    act(() => draw.replaceWith(toFeatures([MOVED])));
    await userEvent.click(screen.getByRole("button", { name: "Save boundary" }));

    await waitFor(() =>
      expect(api.mock.calls).toContainEqual(
        expect.objectContaining({ method: "PUT", path: `${AREAS}/a-1/boundary`, body: { coordinates: [MOVED] } }),
      ),
    );
    await waitFor(() => expect(draw.started).toBe(false));
  });

  it("starts an area without a boundary in drawing mode and saves nothing empty", async () => {
    const draw = await openEditor("Draw boundary");

    expect(draw.mode).toBe("polygon");
    expect(screen.getByRole("button", { name: "Save boundary" })).toBeDisabled();
    expect(screen.getByText(/Drawing the boundary/)).toBeInTheDocument();
    expect(screen.queryByText(/No boundary yet/)).not.toBeInTheDocument();
  });

  it("deletes the selected part", async () => {
    withArea({ boundary: [SQUARE[0], MOVED] });
    const draw = await openEditor("Edit boundary");
    const [first] = draw.features;

    act(() => draw.emit("select", first.id));
    await userEvent.click(screen.getByRole("button", { name: "Delete selected part" }));

    expect(toBoundary(draw.features)).toEqual([MOVED]);
  });

  it("previews the boundary as it is being reshaped", async () => {
    withArea({ boundary: SQUARE });
    const draw = await openEditor("Edit boundary");

    act(() => draw.replaceWith(toFeatures([MOVED])));

    await waitFor(() =>
      expect(api.mock.calls).toContainEqual(
        expect.objectContaining({
          method: "POST",
          path: `${AREAS}/a-1/boundary-preview`,
          body: { coordinates: [MOVED] },
        }),
      ),
    );
  });

  it("leaves the boundary as it was on cancel", async () => {
    withArea({ boundary: SQUARE });
    const draw = await openEditor("Edit boundary");

    act(() => draw.replaceWith(toFeatures([MOVED])));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(draw.started).toBe(false);
    expect(api.mock.calls.some((call) => call.method === "PUT")).toBe(false);
  });
});
