// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import type { ContentReportDetailResponse, ContentReportSummaryResponse } from "@/api/generated/model";
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

import ModerationPage from "./moderation";

const REPORTS = "/api/v1/admin/content-reports/reports";
const COUNTS = "/api/v1/admin/content-reports/counts";
const BAN = "/api/v1/admin/users/author-1/ban";
const decideUrl = (id: string) => `${REPORTS}/${id}/decide`;

function summary(overrides: Partial<ContentReportSummaryResponse> = {}): ContentReportSummaryResponse {
  return {
    identifier: "report-1",
    contentType: "Review",
    contentIdentifier: "review-1",
    trailIdentifier: null,
    reason: "Offensive",
    reporterNote: null,
    status: "Pending",
    hideOutcome: "Hidden",
    reporterNickName: "VandrarVennen",
    authorNickName: "SkogsGreven",
    authorIdentifier: "author-1",
    authorBannedAt: null,
    contentSnapshot: "Something unpleasant",
    contentImageUrl: null,
    contentStillExists: true,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    createdAt: "2026-05-01T10:00:00Z",
    ...overrides,
  };
}

let rows: ContentReportSummaryResponse[] = [];

function detailOf(report: ContentReportSummaryResponse): ContentReportDetailResponse {
  return {
    report,
    authorStrikes: 1,
    reporterTotal: 4,
    reporterPending: 1,
    reporterDismissed: 0,
    reporterUpheld: 3,
  };
}

const calls = (method: string, path: string) =>
  api.mock.calls.filter((call) => call.method === method && call.path === path);

function listParams() {
  const last = calls("GET", REPORTS).at(-1);
  return new URL(last?.url ?? REPORTS, "http://x").searchParams;
}

function Location() {
  const { search } = useLocation();
  return <output data-testid="location">{search}</output>;
}

function renderPage(reports: ContentReportSummaryResponse[], url = "/moderation") {
  rows = reports;
  for (const row of reports) {
    api.mock.on("GET", `${REPORTS}/${row.identifier}`, () => {
      const current = rows.find((r) => r.identifier === row.identifier) ?? row;
      return detailOf(current);
    });
    api.mock.on("POST", decideUrl(row.identifier), (body) => {
      const { decision, decisionNote } = body as { decision: string; decisionNote?: string };
      rows = rows.map((r) =>
        r.identifier === row.identifier
          ? {
              ...r,
              status: decision === "Uphold" ? "Upheld" : "Dismissed",
              decidedBy: "moderator",
              decisionNote: decisionNote ?? null,
            }
          : r,
      );
      const updated = rows.find((r) => r.identifier === row.identifier) ?? row;
      return detailOf(updated);
    });
  }

  return renderWithProviders(
    <>
      <ModerationPage />
      <Location />
    </>,
    { initialEntries: [url] },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();

  api.mock.on("GET", REPORTS, () => {
    const params = listParams();
    const status = params.get("status");
    const type = params.get("contentType");
    const items = rows.filter((r) => (!status || r.status === status) && (!type || r.contentType === type));
    return { items, page: 1, hasMore: false, totalCount: items.length };
  });
  api.mock.on("GET", COUNTS, () => ({
    pending: rows.filter((r) => r.status === "Pending").length,
    dismissed: 0,
    upheld: rows.filter((r) => r.status === "Upheld").length,
    contentExpired: 0,
  }));
  api.mock.on("POST", BAN, () => {
    rows = rows.map((r) => ({ ...r, authorBannedAt: "2026-03-04T10:00:00Z" }));
    return undefined;
  });
  api.mock.on("DELETE", BAN, () => {
    rows = rows.map((r) => ({ ...r, authorBannedAt: null }));
    return undefined;
  });
});

describe("the queue", () => {
  it("lists the queue and opens the first report", async () => {
    renderPage([summary()]);

    expect(await screen.findByTestId("content-snapshot")).toHaveTextContent("Something unpleasant");
    expect(screen.getByTestId("author-strikes")).toHaveTextContent("1 strike");
    expect(screen.getByTestId("reporter-record")).toHaveTextContent("4 reports, 0 dismissed");
    expect(await screen.findByText(/1 pending/)).toBeInTheDocument();
  });

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

  it("explains an empty queue in terms of the filters that narrowed it", async () => {
    renderPage([]);

    expect(await screen.findByText(/Nothing matches status Pending/)).toBeInTheDocument();
    expect(screen.getByText("Pick a report to see what was reported.")).toBeInTheDocument();
  });

  it("opens the report that was clicked", async () => {
    const user = userEvent.setup();
    renderPage([summary(), summary({ identifier: "report-2", contentSnapshot: "Something else" })]);
    await screen.findByText("Something unpleasant");

    await user.click(screen.getAllByTestId("report-row")[1]);

    expect(await screen.findByText("Something else")).toBeInTheDocument();
    expect(screen.getAllByTestId("report-row")[1]).toHaveAttribute("aria-current", "true");
  });
});

describe("filters", () => {
  it.each(["EventPost", "HikeImage"])("filters the queue on %s and keeps it in the address", async (type) => {
    const user = userEvent.setup();
    renderPage([summary()]);
    await screen.findByTestId("content-snapshot");

    await user.click(screen.getByRole("button", { name: type }));

    await waitFor(() => expect(listParams().get("contentType")).toBe(type));
    expect(screen.getByTestId("location")).toHaveTextContent(`contentType=${type}`);
  });

  it("starts from the filters in the address", async () => {
    renderPage([summary({ status: "Upheld" })], "/moderation?status=Upheld");

    expect(await screen.findByTestId("content-snapshot")).toBeInTheDocument();
    expect(calls("GET", REPORTS)[0].url).toContain("status=Upheld");
    expect(screen.getByRole("button", { name: "Upheld" })).toHaveAttribute("aria-pressed", "true");
  });

  it("asks for every status when All is picked, and goes back to the first page", async () => {
    const user = userEvent.setup();
    renderPage([summary()], "/moderation?page=3");
    await screen.findByText(/Page 3/);

    await user.click(screen.getAllByRole("button", { name: "All" })[0]);

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("?status=All"));
    await waitFor(() => expect(listParams().get("page")).toBe("1"));
    expect(listParams().has("status")).toBe(false);
  });
});

describe("deciding", () => {
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

  it("dismisses, then moves on to the next report in the queue", async () => {
    const user = userEvent.setup();
    renderPage([summary(), summary({ identifier: "report-2", contentSnapshot: "Something else" })]);

    await user.click(await screen.findByTestId("dismiss"));

    expect(await screen.findByText("Something else")).toBeInTheDocument();
    expect(calls("POST", decideUrl("report-1"))[0]?.body).toEqual({ decision: "Dismiss" });
    expect(toasts.toast.success).toHaveBeenCalledWith("The content is visible again.");
    expect(screen.getAllByTestId("report-row")).toHaveLength(1);
    expect(await screen.findByText(/1 pending/)).toBeInTheDocument();
  });

  it("does not delete anything until the confirmation is accepted", async () => {
    const user = userEvent.setup();
    renderPage([summary()]);

    await user.click(await screen.findByTestId("mark-read"));
    await user.click(screen.getByTestId("uphold"));

    expect(calls("POST", decideUrl("report-1"))).toHaveLength(0);

    await user.click(await screen.findByTestId("confirm-uphold"));

    await waitFor(() => expect(calls("POST", decideUrl("report-1"))[0]?.body).toEqual({ decision: "Uphold" }));
    expect(toasts.toast.success).toHaveBeenCalledWith("The content was removed and a strike recorded.");
    await waitFor(() => expect(screen.queryByTestId("confirm-uphold")).toBeNull());
  });

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
      expect(calls("POST", decideUrl("report-1"))[0]?.body).toEqual({
        decision: "Uphold",
        decisionNote: "Personal data",
      }),
    );
  });

  it("keeps the confirmation open and says why when the decision fails", async () => {
    const user = userEvent.setup();
    renderPage([summary()]);
    api.mock.on("POST", decideUrl("report-1"), () => {
      throw new Error("Already decided");
    });

    await user.click(await screen.findByTestId("mark-read"));
    await user.click(screen.getByTestId("uphold"));
    await user.click(await screen.findByTestId("confirm-uphold"));

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith("Already decided"));
    expect(screen.getByTestId("confirm-uphold")).toBeEnabled();
  });

  it("explains when only the snapshot is left, and allows no dismiss", async () => {
    renderPage([summary({ status: "ContentExpired", contentStillExists: false })], "/moderation?status=ContentExpired");

    expect(await screen.findByTestId("content-gone")).toBeInTheDocument();
    expect(screen.getByTestId("dismiss")).toBeDisabled();
  });

  it("offers no decision on a report that is already settled", async () => {
    renderPage([summary({ status: "Upheld", decidedBy: "moderator" })], "/moderation?status=Upheld");

    await screen.findByTestId("content-snapshot");
    expect(screen.queryByTestId("uphold")).toBeNull();
    expect(screen.queryByTestId("dismiss")).toBeNull();
    expect(screen.getByText(/Decided upheld by moderator/)).toBeInTheDocument();
  });
});

describe("keyboard", () => {
  it("steps through the queue with j and k", async () => {
    const user = userEvent.setup();
    renderPage([summary(), summary({ identifier: "report-2", contentSnapshot: "Something else" })]);
    await screen.findByText("Something unpleasant");

    await user.keyboard("j");
    expect(await screen.findByText("Something else")).toBeInTheDocument();

    await user.keyboard("k");
    expect(await screen.findByText("Something unpleasant")).toBeInTheDocument();
  });

  it("dismisses with d", async () => {
    const user = userEvent.setup();
    renderPage([summary()]);
    await screen.findByTestId("dismiss");

    await user.keyboard("d");

    await waitFor(() => expect(calls("POST", decideUrl("report-1"))).toHaveLength(1));
  });

  it("prepares an uphold with u only after the content was read", async () => {
    const user = userEvent.setup();
    renderPage([summary()]);
    await screen.findByTestId("uphold");

    await user.keyboard("u");
    expect(screen.queryByTestId("confirm-uphold")).toBeNull();

    await user.click(screen.getByTestId("mark-read"));
    await user.keyboard("u");

    expect(await screen.findByTestId("confirm-uphold")).toBeInTheDocument();
    expect(calls("POST", decideUrl("report-1"))).toHaveLength(0);
  });

  it("does not act on a shortcut typed into a text field", async () => {
    const user = userEvent.setup();
    renderPage([summary()]);

    await user.click(await screen.findByTestId("mark-read"));
    await user.click(screen.getByTestId("uphold"));
    await user.type(await screen.findByTestId("decision-note"), "d");

    expect(calls("POST", decideUrl("report-1"))).toHaveLength(0);
  });
});

describe("the author", () => {
  it("bans the author of whatever is open, only after the moderator confirms", async () => {
    const user = userEvent.setup();
    renderPage([summary({ contentType: "TrailObstacle" })]);

    await user.click(await screen.findByTestId("ban-author"));
    expect(calls("POST", BAN)).toHaveLength(0);
    await user.click(screen.getByTestId("confirm-ban"));

    await waitFor(() =>
      expect(calls("POST", BAN)).toEqual([
        expect.objectContaining({ body: { reason: expect.stringContaining("report-1") } }),
      ]),
    );
  });

  it("offers to lift the ban straight after banning, without reselecting the report", async () => {
    const user = userEvent.setup();
    renderPage([summary()]);

    await user.click(await screen.findByTestId("ban-author"));
    await user.click(screen.getByTestId("confirm-ban"));

    expect(await screen.findByTestId("unban-author")).toHaveTextContent("Lift the ban");
    expect(screen.queryByTestId("ban-author")).toBeNull();
  });

  it("offers no ban once the author is gone", async () => {
    renderPage([summary({ authorIdentifier: null, authorNickName: null })]);

    await screen.findByTestId("content-snapshot");

    expect(screen.queryByTestId("ban-author")).toBeNull();
  });

  it("lifts the ban on an author who is already banned, and offers a ban again", async () => {
    const user = userEvent.setup();
    renderPage([summary({ authorBannedAt: "2026-03-04T10:00:00Z" })]);

    expect(await screen.findByTestId("author-banned-since")).toHaveTextContent("Banned");
    expect(screen.queryByTestId("ban-author")).toBeNull();

    await user.click(screen.getByTestId("unban-author"));

    expect(await screen.findByTestId("ban-author")).toBeInTheDocument();
    expect(calls("DELETE", BAN)).toHaveLength(1);
  });

  it("says why when the ban cannot be lifted", async () => {
    const user = userEvent.setup();
    renderPage([summary({ authorBannedAt: "2026-03-04T10:00:00Z" })]);
    api.mock.on("DELETE", BAN, () => {
      throw new Error("the server said no");
    });

    await user.click(await screen.findByTestId("unban-author"));

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith("the server said no"));
  });

  it("says why when the ban fails", async () => {
    const user = userEvent.setup();
    renderPage([summary()]);
    api.mock.on("POST", BAN, () => {
      throw new Error("the server said no");
    });

    await user.click(await screen.findByTestId("ban-author"));
    await user.click(screen.getByTestId("confirm-ban"));

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith("the server said no"));
  });
});

describe("images", () => {
  it("shows a reported hike image as the picture itself and names it in the warning", async () => {
    const user = userEvent.setup();
    renderPage([
      summary({
        contentType: "HikeImage",
        contentSnapshot: "hikes/abc.jpg",
        contentImageUrl: "https://media.stigvidd.se/hikes/abc.jpg",
      }),
    ]);

    const image = await screen.findByTestId("content-image");
    expect(image).toHaveAttribute("src", "https://media.stigvidd.se/hikes/abc.jpg");
    expect(screen.queryByTestId("content-snapshot")).toBeNull();

    await user.click(screen.getByTestId("mark-read"));
    await user.click(screen.getByTestId("uphold"));

    expect(await screen.findByTestId("confirm-body")).toHaveTextContent("hike image for good");
  });

  it("shows a reported event cover as a picture and names it in the warning", async () => {
    const user = userEvent.setup();
    renderPage([
      summary({
        contentType: "EventImage",
        contentSnapshot: "events/abc.jpg",
        contentImageUrl: "https://media.stigvidd.se/events/abc.jpg",
      }),
    ]);

    const image = await screen.findByTestId("content-image");
    expect(image).toHaveAttribute("alt", "The reported event cover image");
    await user.click(screen.getByTestId("mark-read"));
    await user.click(screen.getByTestId("uphold"));

    expect(await screen.findByTestId("confirm-body")).toHaveTextContent("event cover image for good");
  });
});
