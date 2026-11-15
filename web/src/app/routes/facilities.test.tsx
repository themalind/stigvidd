// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminFacilityResponse } from "@/api/generated/model";
import { QueryBoundary } from "@/components/query-boundary";
import { answerConfirm } from "@/testing/confirm";
import { maps } from "@/testing/fake-maplibre";
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

import FacilitiesPage from "./facilities";

const FACILITIES = "/api/v1/admin/facilities";

function facility(overrides: Partial<AdminFacilityResponse>): AdminFacilityResponse {
  return {
    identifier: "f-1",
    name: "Name",
    facilityType: 8,
    isAccessible: false,
    latitude: 57.7,
    longitude: 12.9,
    location: "",
    description: "",
    url: "",
    sourceId: null,
    sourceKey: null,
    nameKey: "",
    areaNames: [],
    lastUpdatedAt: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

function renderPage(entry = "/facilities") {
  return renderWithProviders(
    <QueryBoundary>
      <FacilitiesPage />
    </QueryBoundary>,
    { initialEntries: [entry] },
  );
}

beforeEach(() => {
  api.mock.reset();
  vi.clearAllMocks();
  api.mock.on("GET", FACILITIES, () => [
    facility({
      identifier: "hand",
      name: "Dalsjöns badplats",
      nameKey: "dalsjön",
      latitude: null,
      longitude: null,
      areaNames: ["Dalsjöfors"],
    }),
    facility({
      identifier: "imported",
      name: "Dalsjön badplats",
      nameKey: "dalsjön",
      sourceId: "boras:badplatser:1490-6474",
      sourceKey: "boras:badplatser",
    }),
    facility({ identifier: "firepit", name: "Rya åsar grillplats", nameKey: "rya åsar", facilityType: 1 }),
  ]);
});

describe("FacilitiesPage", () => {
  it("lists every facility with where it came from and its areas", async () => {
    renderPage();

    expect(await screen.findByText("Dalsjöns badplats")).toBeInTheDocument();
    expect(screen.getByText("boras:badplatser")).toBeInTheDocument();
    expect(screen.getByText("Dalsjöfors")).toBeInTheDocument();
    expect(screen.getByText("3 of 3 facilities")).toBeInTheDocument();
  });

  it("narrows the list to likely duplicates from the address", async () => {
    renderPage("/facilities?duplicates=Likely");

    expect(await screen.findByText("2 of 3 facilities")).toBeInTheDocument();
    expect(screen.queryByText("Rya åsar grillplats")).not.toBeInTheDocument();
  });

  it("deletes a facility only after it is confirmed", async () => {
    api.mock.on("DELETE", `${FACILITIES}/imported`, () => undefined);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Delete Dalsjön badplats" }));
    const asked = await answerConfirm("yes");

    expect(asked).toContain("adds it again as new");
    await waitFor(() =>
      expect(api.mock.calls.some((c) => c.method === "DELETE" && c.path === `${FACILITIES}/imported`)).toBe(true),
    );
  });

  it("draws the facility as a point, longitude first, among the others", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Show Dalsjön badplats on map" }));
    const map = maps.at(-1);
    if (!map) throw new Error("expected a map");
    map.loadStyle();

    expect(map.sources.facility).toEqual({
      type: "FeatureCollection",
      features: [expect.objectContaining({ geometry: { type: "Point", coordinates: [12.9, 57.7] } })],
    });
    expect((map.sources.neighbours as GeoJSON.FeatureCollection).features).toHaveLength(2);
  });

  it("cannot open the map for a facility without a position", async () => {
    renderPage();

    expect(await screen.findByRole("button", { name: "Show Dalsjöns badplats on map" })).toBeDisabled();
  });

  it("fills in the coordinates where the map is clicked and follows typed ones", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Edit Dalsjöns badplats" }));
    const map = maps.at(-1);
    if (!map) throw new Error("expected a map");
    map.loadStyle();
    act(() => map.click(12.897360235551368, 57.71180557766352));

    expect(screen.getByLabelText("Latitude")).toHaveValue("57.711806");
    expect(screen.getByLabelText("Longitude")).toHaveValue("12.897360");
    const jump = vi.spyOn(map, "jumpTo");

    await userEvent.clear(screen.getByLabelText("Latitude"));
    await userEvent.type(screen.getByLabelText("Latitude"), "57.72");

    await waitFor(() => expect(map.center).toEqual([12.89736, 57.72]));
    expect(jump).toHaveBeenCalledOnce();
  });

  it("does not move the map under a click", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Edit Dalsjöns badplats" }));
    const map = maps.at(-1);
    if (!map) throw new Error("expected a map");
    map.loadStyle();
    const jump = vi.spyOn(map, "jumpTo");
    act(() => map.click(12.897360235551368, 57.71180557766352));

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(jump).not.toHaveBeenCalled();
  });

  it("keeps the facility when the deletion is cancelled", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Delete Dalsjön badplats" }));
    await answerConfirm("no");

    expect(api.mock.calls.some((c) => c.method === "DELETE")).toBe(false);
  });
});
