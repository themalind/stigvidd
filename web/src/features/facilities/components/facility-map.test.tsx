// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { maps } from "@/testing/fake-maplibre";
import { FacilityMap } from "./facility-map";

vi.mock("maplibre-gl", () => import("@/testing/fake-maplibre"));

beforeEach(() => {
  maps.length = 0;
});

// keep-comment: jsdom does no layout, so the class is what can be asserted; without it a scrolling form squeezed the map to a strip
it("keeps its height inside a scrolling column instead of shrinking to a strip", () => {
  render(<FacilityMap position={[12.94, 57.72]} satellite={false} className="h-80" />);

  const frame = screen.getByTestId("facility-map").parentElement;
  expect(frame).toHaveClass("shrink-0", "h-80");
  expect(frame).not.toHaveClass("h-[480px]");
});

it("asks for a click when the facility has no position and can be placed", () => {
  render(<FacilityMap position={null} satellite={false} onPick={vi.fn()} />);

  expect(screen.getByText("No position. Click the map to place it.")).toBeInTheDocument();
});
