// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Jump, LngLat } from "@/lib/geometry-edit";

const api = vi.hoisted(() => ({ getTrailPath: vi.fn() }));
vi.mock("@/api/trail", () => api);

const toasted = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasted }));

const drawn = vi.hoisted(() => ({ path: null as LngLat[] | null, gaps: null as Jump[] | null }));
vi.mock("./trails/trail-path-map", () => ({
  TrailPathMap: ({ path, gaps }: { path: LngLat[]; gaps: Jump[] }) => {
    drawn.path = path;
    drawn.gaps = gaps;
    return <div data-testid="trail-path-map" />;
  },
}));

import TrailPathDialog from "./trail-path-dialog";

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
  drawn.path = null;
  drawn.gaps = null;
  api.getTrailPath.mockResolvedValue(path);
});

describe("TrailPathDialog", () => {
  it("fetches the trail's path when opened and draws it", async () => {
    render(<TrailPathDialog data={trail} />);
    await open();

    expect(await screen.findByTestId("trail-path-map")).toBeInTheDocument();
    expect(api.getTrailPath).toHaveBeenCalledWith("trail-1");
    expect(drawn.path).toEqual(path);
  });

  it("summarises the points and flags the long gap", async () => {
    render(<TrailPathDialog data={trail} />);
    await open();
    await screen.findByTestId("trail-path-map");

    expect(screen.getByText("Points").nextSibling).toHaveTextContent("4");
    expect(screen.getByText("Stated length").nextSibling).toHaveTextContent("3 km");
    expect(screen.getByText(/Gaps over/).nextSibling).toHaveTextContent("1");
    expect(drawn.gaps).toEqual([expect.objectContaining({ index: 2 })]);
  });

  it("says there is nothing to draw for a trail without a line", async () => {
    api.getTrailPath.mockResolvedValue([]);

    render(<TrailPathDialog data={trail} />);
    await open();

    expect(await screen.findByText("This trail has no line to draw.")).toBeVisible();
    expect(screen.queryByTestId("trail-path-map")).not.toBeInTheDocument();
  });

  it("reports a failed load instead of an empty map", async () => {
    api.getTrailPath.mockRejectedValue(new Error("offline"));

    render(<TrailPathDialog data={trail} />);
    await open();

    expect(await screen.findByText("The coordinates could not be loaded.")).toBeVisible();
    expect(toasted.error).toHaveBeenCalledWith("Failed to load the trail's coordinates.");
  });
});
