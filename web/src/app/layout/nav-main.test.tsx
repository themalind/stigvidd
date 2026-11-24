// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { paths } from "@/config/paths";
import type { Attention } from "@/api/attention";
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

const ATTENTION: Attention = { pendingHikeSubmissions: 2, pendingReports: 3, failedMails: 0, importsAwaitingReview: 0 };

function renderAt(path: string, { collapsed = false, attention }: { collapsed?: boolean; attention?: Attention } = {}) {
  const router = createMemoryRouter([{ path: "*", element: <NavMain attention={attention} /> }], {
    initialEntries: [path],
  });
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

  it("shows a folded group with the work waiting on all its pages", () => {
    renderAt(paths.dashboard, { attention: { ...ATTENTION, importsAwaitingReview: 1, failedMails: 4 } });

    expect(screen.getByRole("button", { name: "Contributions" }).closest("li")).toHaveTextContent("2 waiting");
    expect(screen.getByRole("button", { name: "Community" }).closest("li")).toHaveTextContent("3 waiting");
    expect(screen.getByRole("button", { name: "Import" }).closest("li")).toHaveTextContent("1 waiting");
    expect(screen.getByRole("button", { name: "Mail" }).closest("li")).toHaveTextContent("4 waiting");
  });

  it("shows each page's count once its group is open, not the group's sum as well", () => {
    renderAt(paths.hikeSubmissions, { attention: ATTENTION });

    expect(screen.getByRole("link", { name: /^Hike Submissions,\s*2\s*waiting$/ })).toBeVisible();
    expect(screen.getByRole("link", { name: "User Walks" })).toBeVisible();
    expect(screen.getAllByText(/waiting/)).toHaveLength(2);
  });

  it("makes room for a folded group's badge, so it never covers the chevron", async () => {
    renderAt(paths.dashboard, { attention: { ...ATTENTION, importsAwaitingReview: 1, failedMails: 4 } });
    for (const group of ["Contributions", "Community", "Mail"]) {
      expect(screen.getByRole("button", { name: group })).toHaveClass("pr-9");
    }
    const importButton = screen.getByRole("button", { name: "Import" });

    expect(importButton).toHaveClass("pr-9");

    await userEvent.click(importButton);
    expect(screen.getByRole("button", { name: "Import" })).not.toHaveClass("pr-9");
  });

  it("leaves a folded group without a badge its normal padding", () => {
    renderAt(paths.dashboard, { attention: { ...ATTENTION, importsAwaitingReview: 0 } });

    expect(screen.getByRole("button", { name: "Import" })).not.toHaveClass("pr-9");
  });

  it("shows no badge where nothing waits", () => {
    renderAt(paths.dashboard, { attention: { ...ATTENTION, pendingHikeSubmissions: 0, pendingReports: 0 } });

    expect(screen.queryByText(/waiting/)).not.toBeInTheDocument();
  });

  it("shows no badge while the counts are unknown", () => {
    renderAt(paths.dashboard);

    expect(screen.queryByText(/waiting/)).not.toBeInTheDocument();
  });

  it("keeps a collapsed group's count on its entry on the desktop", () => {
    vi.stubGlobal("innerWidth", 1280);

    renderAt(paths.dashboard, { collapsed: true, attention: ATTENTION });

    expect(screen.getByRole("link", { name: "Community" }).closest("li")).toHaveTextContent("3 waiting");
  });

  it("shows a collapsed group as a link to its first page on the desktop", () => {
    vi.stubGlobal("innerWidth", 1280);

    renderAt(paths.dashboard, { collapsed: true });

    expect(screen.getByRole("link", { name: "Import" })).toHaveAttribute("href", paths.trailImport);
  });
});
