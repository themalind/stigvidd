// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminFacilityResponse } from "@/api/generated/model";
import { ApiError } from "@/api/mutator";
import { QueryBoundary } from "@/components/query-boundary";
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

import CityAreasPage from "./city-areas";

const AREAS = "/api/v1/admin/city-areas";
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
      facilities: [{ identifier: "f-1", name: "Grillplats Rya", facilityType: 1 }],
      trails: [],
    },
    { identifier: "a-2", name: "Öresjö", location: "Öster om Borås", facilities: [], trails: [] },
  ]);
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

    await userEvent.click(screen.getByRole("combobox"));
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
