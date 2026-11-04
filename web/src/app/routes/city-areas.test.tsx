// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function seed() {
  api.mock.on("GET", AREAS, () => [
    {
      identifier: "a-1",
      name: "Rya åsar",
      location: "Norr om Borås",
      facilities: [{ identifier: "f-1", name: "Grillplats Rya", facilityType: 1 }],
      trails: [],
    },
  ]);
  api.mock.on("GET", "/api/v1/admin/facilities", () => [
    { identifier: "f-1", name: "Grillplats Rya", facilityType: 1, isAccessible: true },
    { identifier: "f-2", name: "Vindskydd Rya", facilityType: 2, isAccessible: false },
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
