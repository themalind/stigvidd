// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/api/mutator";
import { renderWithProviders } from "@/testing/render";
import type { Jump, LngLat } from "@/utils/geometry-edit";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const drawn = vi.hoisted(() => ({ path: null as LngLat[] | null, gaps: null as Jump[] | null }));
vi.mock("./trail-path-map", () => ({
  TrailPathMap: ({ path, gaps }: { path: LngLat[]; gaps: Jump[] }) => {
    drawn.path = path;
    drawn.gaps = gaps;
    return <div data-testid="trail-path-map" />;
  },
}));

import TrailPathDialog from "./trail-path-dialog";

const PATH = "/api/v1/admin/trails/trail-1/path";
const trail = { identifier: "trail-1", name: "Knalleleden", trailLength: 3 };

// keep-comment: 0.001° of latitude is about 111 m, so only the last step (about 1.1 km) is a gap
const path: LngLat[] = [
  [12.94, 57.72],
  [12.94, 57.721],
  [12.94, 57.722],
  [12.94, 57.732],
];

const open = () => userEvent.click(screen.getByRole("button", { name: "Show trail on map" }));

beforeEach(() => {
  api.mock.reset();
  drawn.path = null;
  drawn.gaps = null;
  api.mock.on("GET", PATH, () => ({ coordinates: path }));
});

describe("TrailPathDialog", () => {
  it("fetches nothing until it is opened", () => {
    renderWithProviders(<TrailPathDialog data={trail} />);

    expect(api.mock.calls).toHaveLength(0);
  });

  it("fetches the trail's path when opened and draws it", async () => {
    renderWithProviders(<TrailPathDialog data={trail} />);
    await open();

    expect(await screen.findByTestId("trail-path-map")).toBeInTheDocument();
    expect(drawn.path).toEqual(path);
  });

  it("drops a coordinate that is not a longitude/latitude pair", async () => {
    api.mock.on("GET", PATH, () => ({ coordinates: [...path, [12.94]] }));

    renderWithProviders(<TrailPathDialog data={trail} />);
    await open();
    await screen.findByTestId("trail-path-map");

    expect(drawn.path).toEqual(path);
  });

  it("summarises the points and flags the long gap", async () => {
    renderWithProviders(<TrailPathDialog data={trail} />);
    await open();
    await screen.findByTestId("trail-path-map");

    expect(screen.getByText("Points").nextSibling).toHaveTextContent("4");
    expect(screen.getByText("Stated length").nextSibling).toHaveTextContent("3 km");
    expect(screen.getByText(/Gaps over/).nextSibling).toHaveTextContent("1");
    expect(drawn.gaps).toEqual([expect.objectContaining({ index: 2 })]);
  });

  it("says there is nothing to draw for a trail without a line", async () => {
    api.mock.on("GET", PATH, () => ({ coordinates: [] }));

    renderWithProviders(<TrailPathDialog data={trail} />);
    await open();

    expect(await screen.findByText("This trail has no line to draw.")).toBeVisible();
    expect(screen.queryByTestId("trail-path-map")).not.toBeInTheDocument();
  });

  it("reports a failed load instead of an empty map, and can try again", async () => {
    api.mock.on("GET", PATH, () => {
      throw new ApiError("Not found", 404);
    });

    renderWithProviders(<TrailPathDialog data={trail} />);
    await open();

    expect(await screen.findByText("The coordinates could not be loaded.")).toBeVisible();

    api.mock.on("GET", PATH, () => ({ coordinates: path }));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByTestId("trail-path-map")).toBeInTheDocument());
  });
});
