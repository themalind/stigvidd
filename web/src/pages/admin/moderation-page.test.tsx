// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { ReportDetail, ReportSummary } from "@/api/content-reports";
import ModerationPage from "./moderation-page";

// The page's own imports, stubbed at the module boundary.
const api = vi.hoisted(() => ({
  getReports: vi.fn(),
  getReport: vi.fn(),
  getCounts: vi.fn(),
  decideReport: vi.fn(),
}));
vi.mock("@/api/content-reports", () => api);

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

const users = vi.hoisted(() => ({ banUser: vi.fn(), unbanUser: vi.fn() }));
vi.mock("@/api/users", () => users);

function summary(overrides: Partial<ReportSummary> = {}): ReportSummary {
  return {
    identifier: "report-1",
    contentType: "Review",
    contentIdentifier: "review-1",
    reason: "Offensive",
    status: "Pending",
    hideOutcome: "Hidden",
    reporterNickName: "VandrarVennen",
    authorNickName: "SkogsGreven",
    authorIdentifier: "author-1",
    contentSnapshot: "Something unpleasant",
    contentStillExists: true,
    createdAt: "2026-05-01T10:00:00Z",
    ...overrides,
  } as ReportSummary;
}

function detail(report: ReportSummary, overrides: Partial<ReportDetail> = {}): ReportDetail {
  return {
    report,
    authorStrikes: 1,
    reporterTotal: 4,
    reporterPending: 1,
    reporterDismissed: 0,
    reporterUpheld: 3,
    ...overrides,
  } as ReportDetail;
}

function renderPage(rows: ReportSummary[], reportDetail?: ReportDetail) {
  api.getReports.mockResolvedValue({
    items: rows,
    totalCount: rows.length,
    hasMore: false,
  });
  api.getCounts.mockResolvedValue({
    pending: rows.length,
    dismissed: 0,
    upheld: 0,
    contentExpired: 0,
  });
  api.getReport.mockResolvedValue(reportDetail ?? detail(rows[0] ?? summary()));

  render(
    <MemoryRouter>
      <ModerationPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.decideReport.mockResolvedValue(detail(summary({ status: "Upheld" })));
});

it("lists the queue and opens the first report", async () => {
  renderPage([summary()]);

  expect(await screen.findByTestId("content-snapshot")).toHaveTextContent(
    "Something unpleasant",
  );
  expect(screen.getByTestId("author-strikes")).toHaveTextContent("1 strike");
  expect(screen.getByTestId("reporter-record")).toHaveTextContent("4 reports, 0 dismissed");
});

// Two rows with the same status but different effects in the app look like a bug unless
// the queue says which is which.
it("marks a report that did not hide anything, and explains why", async () => {
  renderPage([summary({ hideOutcome: "WithheldReporterDismissed" })]);

  const marker = await screen.findByTestId("did-not-hide");
  expect(marker).toHaveAttribute("title", expect.stringContaining("dismissed"));
});

it("leaves an ordinary report unmarked", async () => {
  renderPage([summary({ hideOutcome: "Hidden" })]);

  await screen.findByTestId("content-snapshot");
  expect(screen.queryByTestId("did-not-hide")).toBeNull();
});

// Upholding hard-deletes, so the button stays off until the content was actually opened.
it("keeps uphold disabled until the content has been read", async () => {
  const user = userEvent.setup();
  renderPage([summary()]);

  expect(await screen.findByTestId("uphold")).toBeDisabled();

  await user.click(screen.getByTestId("mark-read"));

  expect(screen.getByTestId("uphold")).toBeEnabled();
});

it("leaves dismiss available without reading, because it is reversible", async () => {
  renderPage([summary()]);

  expect(await screen.findByTestId("dismiss")).toBeEnabled();
});

it("does not delete anything until the confirmation is accepted", async () => {
  const user = userEvent.setup();
  renderPage([summary()]);

  await user.click(await screen.findByTestId("mark-read"));
  await user.click(screen.getByTestId("uphold"));

  expect(api.decideReport).not.toHaveBeenCalled();

  await user.click(await screen.findByTestId("confirm-uphold"));

  await waitFor(() =>
    expect(api.decideReport).toHaveBeenCalledWith("report-1", "Uphold", undefined),
  );
});

// The dialog has to say the deletion is permanent and which strike this becomes, because
// the strike count is what a decision to remove an account is built on.
it("says the deletion is permanent and names the strike it becomes", async () => {
  const user = userEvent.setup();
  renderPage([summary()]);

  await user.click(await screen.findByTestId("mark-read"));
  await user.click(screen.getByTestId("uphold"));

  const body = await screen.findByTestId("confirm-body");
  expect(body).toHaveTextContent("cannot be undone");
  expect(body).toHaveTextContent("strike 2");
});

it("sends the decision note when one was typed", async () => {
  const user = userEvent.setup();
  renderPage([summary()]);

  await user.click(await screen.findByTestId("mark-read"));
  await user.click(screen.getByTestId("uphold"));
  await user.type(await screen.findByTestId("decision-note"), "Personal data");
  await user.click(screen.getByTestId("confirm-uphold"));

  await waitFor(() =>
    expect(api.decideReport).toHaveBeenCalledWith("report-1", "Uphold", "Personal data"),
  );
});

// `u` prepares an uphold, so a keystroke landing in a text field must never touch it.
it("does not act on a shortcut typed into a text field", async () => {
  const user = userEvent.setup();
  renderPage([summary()]);

  await user.click(await screen.findByTestId("mark-read"));
  await user.click(screen.getByTestId("uphold"));
  const note = await screen.findByTestId("decision-note");
  await user.type(note, "d");

  expect(api.decideReport).not.toHaveBeenCalled();
});

// Retention or an account deletion may take the content first. Upholding still records the
// strike, so the state has to be shown rather than the row simply looking broken.
it("explains when only the snapshot is left, and still allows uphold", async () => {
  const gone = summary({ status: "ContentExpired", contentStillExists: false });
  renderPage([gone], detail(gone));

  expect(await screen.findByTestId("content-gone")).toBeInTheDocument();
  expect(screen.getByTestId("dismiss")).toBeDisabled();
});

it("offers no decision on a report that is already settled", async () => {
  const settled = summary({ status: "Upheld", decidedBy: "moderator" });
  renderPage([settled], detail(settled));

  await screen.findByTestId("content-snapshot");
  expect(screen.queryByTestId("uphold")).toBeNull();
  expect(screen.queryByTestId("dismiss")).toBeNull();
});

// An empty list has to say whether the filters are what emptied it.
it("explains an empty queue in terms of the filters that narrowed it", async () => {
  renderPage([]);

  expect(await screen.findByText(/Nothing matches status Pending/)).toBeInTheDocument();
});

// The queue covers reviews and obstacle reports alike, so this is the one place a moderator
// can ban the author of either without leaving the item they are looking at.
it("bans the author of whatever is open, only after the moderator confirms", async () => {
  const user = userEvent.setup();
  users.banUser.mockResolvedValue(undefined);
  renderPage([summary({ contentType: "TrailObstacle" })]);

  await user.click(await screen.findByTestId("ban-author"));
  expect(users.banUser).not.toHaveBeenCalled();
  await user.click(screen.getByTestId("confirm-ban"));

  await waitFor(() => expect(users.banUser).toHaveBeenCalledWith("author-1", expect.stringContaining("report-1")));
});

it("offers to lift the ban straight after banning, without reselecting the report", async () => {
  const user = userEvent.setup();
  users.banUser.mockResolvedValue(undefined);
  renderPage([summary()]);

  const banButton = await screen.findByTestId("ban-author");
  api.getReport.mockResolvedValue(detail(summary({ authorBannedAt: "2026-03-04T10:00:00Z" })));
  await user.click(banButton);
  await user.click(screen.getByTestId("confirm-ban"));

  expect(await screen.findByTestId("unban-author")).toHaveTextContent("Lift the ban");
  expect(screen.queryByTestId("ban-author")).toBeNull();
});

// A deleted author has no identifier left, so there is no account to ban.
it("offers no ban once the author is gone", async () => {
  renderPage([summary({ authorIdentifier: null, authorNickName: null })]);

  await screen.findByTestId("content-snapshot");

  expect(screen.queryByTestId("ban-author")).toBeNull();
});

// The card reads BannedAt back and offers Unban instead.
it("offers to lift the ban on an author who is already banned", async () => {
  const user = userEvent.setup();
  users.unbanUser.mockResolvedValue(undefined);
  renderPage([summary({ authorBannedAt: "2026-03-04T10:00:00Z" })]);

  expect(await screen.findByTestId("author-banned-since")).toHaveTextContent("Banned");
  expect(screen.queryByTestId("ban-author")).toBeNull();

  await user.click(screen.getByTestId("unban-author"));

  await waitFor(() => expect(users.unbanUser).toHaveBeenCalledWith("author-1"));
});

it("says why when the bar cannot be lifted", async () => {
  const user = userEvent.setup();
  users.unbanUser.mockRejectedValue(new Error("the server said no"));
  renderPage([summary({ authorBannedAt: "2026-03-04T10:00:00Z" })]);

  await user.click(await screen.findByTestId("unban-author"));

  await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("the server said no"));
});

it("says why when the ban fails, and leaves the queue alone", async () => {
  const user = userEvent.setup();
  users.banUser.mockRejectedValue(new Error("the server said no"));
  renderPage([summary()]);

  await user.click(await screen.findByTestId("ban-author"));
  await user.click(screen.getByTestId("confirm-ban"));

  await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("the server said no"));
});
