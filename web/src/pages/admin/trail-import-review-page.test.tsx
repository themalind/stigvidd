// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import type { Proposal, Session } from "@/api/trail-import";
import TrailImportReviewPage from "./trail-import-review-page";

// The page's own imports, stubbed at the module boundary. `confidenceOrder` is a value the
// summary row maps over, so a partial mock would render nothing.
const api = vi.hoisted(() => ({
  confidenceOrder: ["Unmatched", "Medium", "High", "Certain"],
  getSession: vi.fn(),
  getProposals: vi.fn(),
  decideBulk: vi.fn(),
}));
vi.mock("@/api/trail-import", () => api);
const trailApi = vi.hoisted(() => ({ getAllTrails: vi.fn() }));
vi.mock("@/api/trail", () => trailApi);

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

// Neither is what this test is about, and both would fetch on their own.
vi.mock("@/components/trail-import/proposal-detail", () => ({
  ProposalDetail: () => <div data-testid="proposal-detail" />,
}));
vi.mock("@/components/trail-import/apply-panel", () => ({
  ApplyPanel: () => <div data-testid="apply-panel" />,
}));

function proposal(id: number, featureName: string, confidence: string): Proposal {
  return {
    id,
    featureName,
    confidence,
    decision: "Pending",
    coverageForward: 0.9,
    coverageBackward: 0.9,
  } as Proposal;
}

const certain = proposal(1, "Kranslingan", "Certain");
const high = proposal(2, "Rya åsar", "High");
const medium = proposal(3, "Vinkelleden", "Medium");

function renderPage(proposals: Proposal[], total = proposals.length) {
  api.getSession.mockResolvedValue({
    id: 1,
    fileName: "boras-2026.geojson",
    status: "AwaitingReview",
    counts: { certain: 1, high: 1, medium: 1, unmatched: 0 },
  } as Session);
  api.getProposals.mockResolvedValue({
    items: proposals,
    totalCount: total,
    hasMore: total > proposals.length,
  });

  render(
    <MemoryRouter initialEntries={["/trail-import/1"]}>
      <Routes>
        <Route path="/trail-import/:sessionId" element={<TrailImportReviewPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const select = (name: string) => screen.getByRole("checkbox", { name: `Select ${name}` });
const acceptSelected = () => screen.getByRole("button", { name: /Accept selected/ });

// restoreMocks clears every implementation between tests, so the ones every render needs
// are set here rather than at the mock factory.
beforeEach(() => {
  trailApi.getAllTrails.mockResolvedValue([]);
  api.decideBulk.mockResolvedValue(2);
});

describe("the batch accept gate", () => {
  it("offers nothing to batch until something is selected", async () => {
    renderPage([certain, high]);

    await screen.findByRole("checkbox", { name: "Select Kranslingan" });

    expect(screen.queryByRole("button", { name: /Accept selected/ })).not.toBeInTheDocument();
  });

  it("is live for a selection the geometry settled by itself", async () => {
    renderPage([certain, high]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Kranslingan" }));
    await userEvent.click(select("Rya åsar"));

    expect(acceptSelected()).toBeEnabled();
  });

  // The consequence this whole gate exists for: Medium is the tier that wanted a human,
  // so one of them in the selection must take batch accept away.
  it("goes dead the moment a Medium joins the selection", async () => {
    renderPage([certain, high, medium]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Kranslingan" }));
    expect(acceptSelected()).toBeEnabled();

    await userEvent.click(select("Vinkelleden"));

    expect(acceptSelected()).toBeDisabled();
  });

  it("comes back once the Medium is deselected again", async () => {
    renderPage([certain, medium]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Kranslingan" }));
    await userEvent.click(select("Vinkelleden"));
    expect(acceptSelected()).toBeDisabled();

    await userEvent.click(select("Vinkelleden"));

    expect(acceptSelected()).toBeEnabled();
  });

  it("says why it is refusing, rather than just being grey", async () => {
    renderPage([medium]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Vinkelleden" }));

    expect(acceptSelected()).toHaveAttribute(
      "title",
      expect.stringContaining("only for Certain and High"),
    );
  });

  it("decides exactly the rows that were selected", async () => {
    renderPage([certain, high, medium]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Kranslingan" }));
    await userEvent.click(select("Rya åsar"));
    await userEvent.click(acceptSelected());

    await waitFor(() =>
      expect(api.decideBulk).toHaveBeenCalledWith(1, {
        proposalIds: [1, 2],
        decision: "Accept",
      }),
    );
  });

  it("clears the selection without deciding anything", async () => {
    renderPage([certain, high]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Kranslingan" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByRole("button", { name: /Accept selected/ })).not.toBeInTheDocument();
    expect(api.decideBulk).not.toHaveBeenCalled();
  });
});

describe("select all matching", () => {
  it("is not offered until the page in view is fully selected", async () => {
    renderPage([certain, high], 203);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Kranslingan" }));

    expect(screen.queryByRole("button", { name: /Select all 203 matching/ })).not.toBeInTheDocument();
  });

  it("is offered once the page is exhausted and the filter holds more", async () => {
    renderPage([certain, high], 203);

    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select every proposal on this page" }),
    );

    expect(screen.getByRole("button", { name: /Select all 203 matching/ })).toBeInTheDocument();
  });

  it("is not offered when the page in view is already everything", async () => {
    renderPage([certain, high]);

    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select every proposal on this page" }),
    );

    expect(screen.queryByRole("button", { name: /Select all/ })).not.toBeInTheDocument();
  });

  // The walk is bounded; a run that stopped short must leave the selection alone rather
  // than present a subset as the whole filter.
  it("leaves the selection untouched when the walk could not finish", async () => {
    renderPage([certain, high], 203);
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select every proposal on this page" }),
    );
    // Every page claims there is another, so the walk runs into its ceiling.
    api.getProposals.mockResolvedValue({ items: [certain], totalCount: 203, hasMore: true });

    await userEvent.click(screen.getByRole("button", { name: /Select all 203 matching/ }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    // The count is rendered in both the header bar and the page bar, hence getAllByText.
    // Still 2 — the incomplete walk did not replace the selection with its one row.
    expect(screen.getAllByText("2 selected").length).toBeGreaterThan(0);
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });
});
