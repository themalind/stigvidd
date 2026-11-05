// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
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
