// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { paths } from "@/config/paths";
import NavMain from "./nav-main";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string, { collapsed = false } = {}) {
  const router = createMemoryRouter([{ path: "*", element: <NavMain /> }], { initialEntries: [path] });
  render(
    <SidebarProvider defaultOpen={!collapsed}>
      <RouterProvider router={router} />
    </SidebarProvider>,
  );
  return router;
}

describe("NavMain", () => {
  it("keeps the importers folded under Import until it is opened", async () => {
    renderAt(paths.dashboard);

    expect(screen.queryByRole("link", { name: "Facility Import" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByRole("link", { name: "Trail Import" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Facility Import" })).toBeVisible();
  });

  it("opens the group of the page that is showing", () => {
    renderAt(paths.hikeSubmission("abc"));

    expect(screen.getByRole("button", { name: "Contributions" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "User Walks" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Hike Submissions" })).toBeVisible();
  });

  it("folds the open page's group when its header is clicked", async () => {
    renderAt(paths.facilityImport);

    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByRole("button", { name: "Import" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Facility Import" })).not.toBeInTheDocument();
  });

  it("opens a group when navigation arrives at one of its pages", async () => {
    const router = renderAt(paths.dashboard);

    await act(() => router.navigate(paths.trailImport));

    expect(screen.getByRole("button", { name: "Import" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the full groups on a phone even when the desktop sidebar is collapsed", () => {
    vi.stubGlobal("innerWidth", 500);

    renderAt(paths.dashboard, { collapsed: true });

    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Import" })).not.toBeInTheDocument();
  });

  it("shows a collapsed group as a link to its first page on the desktop", () => {
    vi.stubGlobal("innerWidth", 1280);

    renderAt(paths.dashboard, { collapsed: true });

    expect(screen.getByRole("link", { name: "Import" })).toHaveAttribute("href", paths.trailImport);
  });
});
