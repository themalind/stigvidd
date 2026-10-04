// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminTrailListItem } from "@/types/types";

const api = vi.hoisted(() => ({
  setTrailVerified: vi.fn(),
}));
vi.mock("@/api/trail", () => api);

const toasts = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("sonner", () => toasts);

import TrailVerifiedToggle from "./trail-verified-toggle";

const trail = (isVerified: boolean): AdminTrailListItem => ({
  identifier: "t-1",
  name: "Knalleleden",
  trailLength: 4,
  accessibility: true,
  classification: 1,
  city: "Borås",
  isVerified,
  hasImages: true,
  hasExampleImages: false,
  hasSymbol: true,
  hasDescription: true,
  hasFullDescription: true,
  createdAt: "2026-01-01T00:00:00Z",
  lastUpdatedAt: "2026-01-01T00:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TrailVerifiedToggle", () => {
  it("shows the trail's current state", () => {
    render(<TrailVerifiedToggle data={trail(false)} />);

    expect(screen.getByRole("checkbox", { name: "Active: Knalleleden" })).not.toBeChecked();
  });

  it("deactivates an active trail", async () => {
    api.setTrailVerified.mockResolvedValue(undefined);
    render(<TrailVerifiedToggle data={trail(true)} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(api.setTrailVerified).toHaveBeenCalledWith("t-1", false);
    await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
    expect(toasts.toast.success).toHaveBeenCalled();
  });

  it("activates an inactive trail", async () => {
    api.setTrailVerified.mockResolvedValue(undefined);
    render(<TrailVerifiedToggle data={trail(false)} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(api.setTrailVerified).toHaveBeenCalledWith("t-1", true);
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
  });

  it("reports the new state once saved", async () => {
    api.setTrailVerified.mockResolvedValue(undefined);
    const onChange = vi.fn();
    render(<TrailVerifiedToggle data={trail(true)} onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
  });

  it("keeps the old state when the request fails", async () => {
    api.setTrailVerified.mockRejectedValue(new Error("offline"));
    const onChange = vi.fn();
    render(<TrailVerifiedToggle data={trail(true)} onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalled());
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });
});
