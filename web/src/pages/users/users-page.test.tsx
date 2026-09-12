// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthorStatistic, ReporterStatistic } from "@/api/content-reports";
import UsersPage from "./users-page";

// The page's own imports, stubbed at the module boundary.
const api = vi.hoisted(() => ({
  getReporters: vi.fn(),
  getAuthors: vi.fn(),
}));
vi.mock("@/api/content-reports", () => api);

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

function reporter(overrides: Partial<ReporterStatistic> = {}): ReporterStatistic {
  return {
    nickName: "VandrarVennen",
    total: 4,
    pending: 1,
    dismissed: 1,
    upheld: 2,
    lastReportedAt: "2026-05-04T10:00:00Z",
    reportsAreWithheld: false,
    ...overrides,
  };
}

function renderPage(
  reporters: ReporterStatistic[] = [reporter()],
  authors: AuthorStatistic[] = [{ nickName: "SkogsGreven", strikes: 2 }],
  paging: { hasMore?: boolean } = {},
) {
  api.getReporters.mockResolvedValue({
    items: reporters,
    totalCount: reporters.length,
    hasMore: paging.hasMore ?? false,
  });
  api.getAuthors.mockResolvedValue({
    items: authors,
    totalCount: authors.length,
    hasMore: paging.hasMore ?? false,
  });

  render(<UsersPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("opens on the reporters tab and lists their record", async () => {
  renderPage();

  const row = await screen.findByTestId("reporter-row");
  expect(row).toHaveTextContent("VandrarVennen");
  expect(row).toHaveTextContent("67%");
});

// Pending reports are not evidence either way, so a reporter with nothing decided must not
// read as one who is always wrong.
it("says nothing is decided rather than showing zero accuracy", async () => {
  renderPage([reporter({ total: 3, pending: 3, dismissed: 0, upheld: 0 })]);

  expect(await screen.findByTestId("reporter-accuracy")).toHaveTextContent("Nothing decided");
});

// Rows climbing while nothing gets hidden looks like a broken hiding rule unless the tab
// says why.
it("marks a reporter whose reports no longer hide anything, and explains why", async () => {
  renderPage([reporter({ reportsAreWithheld: true })]);

  const marker = await screen.findByTestId("reports-withheld");
  expect(marker).toHaveAttribute("title", expect.stringContaining("no longer hide"));
  expect(screen.getByTestId("withheld-summary")).toHaveTextContent("1 of these accounts");
});

it("leaves an ordinary reporter unmarked", async () => {
  renderPage([reporter()]);

  await screen.findByTestId("reporter-row");
  expect(screen.queryByTestId("reports-withheld")).toBeNull();
  expect(screen.queryByTestId("withheld-summary")).toBeNull();
});

// A deleted account leaves no nickname on either side. An empty cell reads as a rendering
// fault rather than as the fact it is.
it("names a deleted account instead of leaving the cell blank", async () => {
  renderPage([reporter({ nickName: null })]);

  expect(await screen.findByTestId("reporter-row")).toHaveTextContent("Account deleted");
});

it("shows the strikes on the authors tab", async () => {
  const user = userEvent.setup();
  renderPage();

  await screen.findByTestId("reporter-row");
  await user.click(screen.getByRole("tab", { name: "Authors" }));

  const row = await screen.findByTestId("author-row");
  expect(row).toHaveTextContent("SkogsGreven");
  expect(screen.getByTestId("author-strikes")).toHaveTextContent("2");
});

// The number is what an account removal is decided on, so the list has to say what a
// strike counts, or it reads as a report count.
it("says a strike is one piece of content, not one report", async () => {
  const user = userEvent.setup();
  renderPage();

  await screen.findByTestId("reporter-row");
  await user.click(screen.getByRole("tab", { name: "Authors" }));

  expect(await screen.findByText(/one piece of content/i)).toBeInTheDocument();
});

// The two empty states mean opposite things about the backlog: nothing reported at all,
// against reports that were all decided the author's way.
it("explains each empty tab in its own terms", async () => {
  const user = userEvent.setup();
  renderPage([], []);

  expect(await screen.findByTestId("empty-tab")).toHaveTextContent(
    "Nobody has reported anything yet.",
  );

  await user.click(screen.getByRole("tab", { name: "Authors" }));

  expect(await screen.findByTestId("empty-tab")).toHaveTextContent("upheld");
});

it("asks for the next page only when there is one", async () => {
  const user = userEvent.setup();
  renderPage([reporter()], [], { hasMore: true });

  await screen.findByTestId("reporter-row");
  expect(screen.getByTestId("previous-page")).toBeDisabled();

  await user.click(screen.getByTestId("next-page"));

  await waitFor(() => expect(api.getReporters).toHaveBeenCalledWith(2, 25));
});

it("reports a failed load instead of rendering an empty list", async () => {
  api.getReporters.mockRejectedValue(new Error("Nope"));
  api.getAuthors.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });

  render(<UsersPage />);

  await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("Nope"));
  expect(screen.queryByTestId("reporter-row")).toBeNull();
});
