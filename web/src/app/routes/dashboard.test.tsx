// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminDashboardResponse } from "@/api/generated/model";
import { trailListItem } from "@/testing/fixtures/trails";
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

import DashboardPage from "./dashboard";

const REPORT_COUNTS = "/api/v1/admin/content-reports/counts";
const OUTBOX_COUNTS = "/api/v1/admin/mail-outbox/counts";
const SESSIONS = "/api/v1/admin/trail-import/sessions";
const DASHBOARD = "/api/v1/admin/dashboard";
const TRAILS = "/api/v1/admin/trails";

function renderPage() {
  return renderWithProviders(<DashboardPage />, { initialEntries: ["/"] });
}

const fail = (path: string) =>
  api.mock.on("GET", path, () => {
    throw new Error("offline");
  });

function card(label: string): HTMLElement {
  const link = screen.getByText(label).closest("a, div.relative");
  if (!(link instanceof HTMLElement)) throw new Error(`expected a card around "${label}"`);
  return link;
}

let pendingReports = 3;

const dashboard: AdminDashboardResponse = {
  userCount: 1234,
  newUsersLast7Days: 12,
  reviewCount: 87,
  reviewsLast7Days: 4,
  latestReviews: [
    {
      identifier: "r-1",
      trailIdentifier: "t-1",
      trailName: "Björkehov blå",
      rating: 4,
      text: "Fin led genom skogen",
      authorNickName: "Vandraren",
      imageCount: 2,
      isHidden: false,
      createdAt: new Date().toISOString(),
    },
    {
      identifier: "r-2",
      trailIdentifier: "t-2",
      trailName: "Storsjöleden",
      rating: 2,
      text: null,
      authorNickName: null,
      imageCount: 0,
      isHidden: true,
      createdAt: new Date().toISOString(),
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  pendingReports = 3;
  api.mock.on("GET", REPORT_COUNTS, () => ({ pending: pendingReports, dismissed: 0, upheld: 0, contentExpired: 0 }));
  api.mock.on("GET", OUTBOX_COUNTS, () => ({ pending: 2, sending: 0, sent: 0, failed: 0, cancelled: 0, total: 2 }));
  api.mock.on("GET", TRAILS, () => [
    trailListItem({ identifier: "a", isVerified: true, hasImages: true, hasExampleImages: true, hasDescription: true }),
    trailListItem({
      identifier: "b",
      isVerified: false,
      hasImages: false,
      hasExampleImages: false,
      hasDescription: false,
    }),
  ]);
  api.mock.on("GET", SESSIONS, () => [{ status: "AwaitingReview" }, { status: "Applied" }]);
  api.mock.on("GET", DASHBOARD, () => dashboard);
});

describe("DashboardPage", () => {
  it("shows what needs attention, each linking to where it is handled", async () => {
    renderPage();

    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(card("Reports to moderate")).toHaveAttribute("href", "/moderation");
    expect(card("Reports to moderate")).toHaveTextContent("3");
    expect(card("Failed mails")).toHaveTextContent("All clear");
    expect(card("Imports awaiting review")).toHaveTextContent("1");
    expect(card("Trails with example images")).toHaveTextContent("1");
    expect(card("Trails with example images")).toHaveAttribute("href", "/trails?missing=ExampleImages");
  });

  it("shows users and reviews with how many are new this week", async () => {
    renderPage();

    expect(await screen.findByText("1 234")).toBeInTheDocument();
    expect(card("Users")).toHaveTextContent("+12");
    expect(card("Reviews")).toHaveTextContent("87");
    expect(card("Reviews")).toHaveTextContent("+4");
  });

  it("lists the latest reviews, marking hidden ones and anonymous authors", async () => {
    renderPage();

    expect(await screen.findByText("Fin led genom skogen")).toBeInTheDocument();
    expect(screen.getByText("Vandraren")).toBeInTheDocument();
    expect(screen.getByText("Deleted user")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByText("No text, just a rating")).toBeInTheDocument();
    expect(screen.getByLabelText("4 of 5 stars")).toBeInTheDocument();
  });

  it("shows trail counts and health that open the trail list pre-filtered", async () => {
    renderPage();

    expect(await screen.findByText("1 active in the app")).toBeInTheDocument();
    expect(card("Inactive trails")).toHaveAttribute("href", "/trails?status=Inactive");
    expect(card("Inactive trails")).toHaveTextContent("1");
    expect(screen.getByText("Have images").closest("a")).toHaveTextContent("50%");
  });

  it("shows a dash for a source that fails without hiding the others", async () => {
    fail(REPORT_COUNTS);
    fail(DASHBOARD);
    renderPage();

    expect(await screen.findByText("1 active in the app")).toBeInTheDocument();
    expect(card("Reports to moderate")).toHaveTextContent("—");
    expect(card("Imports awaiting review")).toHaveTextContent("1");
    expect(await screen.findByText("The latest reviews could not be loaded.")).toBeInTheDocument();
  });

  it("says when the trails cannot be loaded", async () => {
    fail(TRAILS);
    renderPage();

    expect(await screen.findByText("The trails could not be loaded.")).toBeInTheDocument();
    expect(card("Trails")).toHaveTextContent("—");
    expect(card("Reports to moderate")).toHaveTextContent("3");
  });

  describe("while it stays open", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      return () => vi.useRealTimers();
    });

    it("refreshes what needs attention every minute", async () => {
      renderPage();
      expect(await screen.findByText("3")).toBeInTheDocument();

      pendingReports = 5;
      await act(() => vi.advanceTimersByTimeAsync(60_000));

      expect(card("Reports to moderate")).toHaveTextContent("5");
    });

    it("keeps the last number and says so when a refresh fails", async () => {
      renderPage();
      expect(await screen.findByText("3")).toBeInTheDocument();

      fail(REPORT_COUNTS);
      await act(() => vi.advanceTimersByTimeAsync(60_000));

      expect(card("Reports to moderate")).toHaveTextContent("3");
      expect(toasts.toast.error).toHaveBeenCalledWith("offline");
    });
  });
});
