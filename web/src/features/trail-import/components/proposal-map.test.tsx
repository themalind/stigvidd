// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { maps } from "@/testing/fake-maplibre";
import { ProposalMap } from "./proposal-map";

vi.mock("maplibre-gl", () => import("@/testing/fake-maplibre"));
vi.mock("@/lib/maplibre", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/maplibre")>()),
  hasSatellite: true,
  mapStyle: (satellite: boolean) => String(satellite),
}));

const A = [
  [12.9, 57.7],
  [12.91, 57.71],
];
const B = [
  [13.1, 57.8],
  [13.11, 57.81],
];

function lineOf(source: unknown) {
  return (source as { features: { geometry: { coordinates: unknown } }[] }).features[0]?.geometry.coordinates;
}

beforeEach(() => {
  maps.length = 0;
});

it("draws the next proposal while the tiles of the first are still loading", () => {
  const { rerender } = render(<ProposalMap feature={A} />);
  const map = maps[0];
  map.emit("style.load");

  rerender(<ProposalMap feature={B} />);

  expect(lineOf(map.sources.feature)).toEqual(B);
});

it("keeps a hidden layer hidden after switching to satellite", async () => {
  const user = userEvent.setup();
  render(<ProposalMap feature={A} trail={B} />);
  const map = maps[0];
  map.emit("style.load");

  await user.click(screen.getByRole("button", { name: /matched trail/i }));
  await user.click(screen.getByRole("button", { name: "Satellite" }));
  map.loadStyle();

  expect(map.styles).toEqual([{ diff: false }]);
  expect(map.visibility["trail-line"]).toBe("none");
  expect(map.visibility["feature-line"]).toBe("visible");
});

it("shows a placeholder instead of a map without geometry", () => {
  render(<ProposalMap feature={[]} />);

  expect(screen.getByText("No geometry to draw.")).toBeInTheDocument();
  expect(maps).toHaveLength(0);
});
