// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reports = vi.hoisted(() => ({ getCounts: vi.fn() }));
vi.mock("@/api/content-reports", () => reports);

const outbox = vi.hoisted(() => ({ getOutboxCounts: vi.fn() }));
vi.mock("@/api/mail-outbox", () => outbox);

const trailApi = vi.hoisted(() => ({ getAllTrails: vi.fn() }));
vi.mock("@/api/trail", () => trailApi);

const imports = vi.hoisted(() => ({ getSessions: vi.fn() }));
vi.mock("@/api/trail-import", () => imports);

const dashboardApi = vi.hoisted(() => ({ getDashboard: vi.fn() }));
vi.mock("@/api/dashboard", () => dashboardApi);

import DashboardPage from "./dashboard-page";

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

function card(label: string): HTMLElement {
  const link = screen.getByText(label).closest("a, div.relative");
  if (!(link instanceof HTMLElement)) throw new Error(`expected a card around "${label}"`);
  return link;
}

beforeEach(() => {
  vi.clearAllMocks();
  reports.getCounts.mockResolvedValue({ pending: 3 });
  outbox.getOutboxCounts.mockResolvedValue({ failed: 0, pending: 2 });
  trailApi.getAllTrails.mockResolvedValue([
    { identifier: "a", isVerified: true, hasImages: true, hasExampleImages: true, hasDescription: true },
    { identifier: "b", isVerified: false, hasImages: false, hasExampleImages: false, hasDescription: false },
  ]);
  imports.getSessions.mockResolvedValue([{ status: "AwaitingReview" }, { status: "Applied" }]);
  dashboardApi.getDashboard.mockResolvedValue({
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
  });
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
    reports.getCounts.mockRejectedValue(new Error("offline"));
    dashboardApi.getDashboard.mockRejectedValue(new Error("offline"));
    renderPage();

    expect(await screen.findByText("1 active in the app")).toBeInTheDocument();
    expect(card("Reports to moderate")).toHaveTextContent("—");
    expect(card("Imports awaiting review")).toHaveTextContent("1");
    expect(await screen.findByText("The latest reviews could not be loaded.")).toBeInTheDocument();
  });
});
