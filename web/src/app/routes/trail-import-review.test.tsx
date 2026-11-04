// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import type { Proposal, Session } from "@/features/trail-import/api/trail-import";
import { diff, preview, proposal, session } from "@/testing/fixtures/trail-import";
import { renderWithProviders } from "@/testing/render";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

vi.mock("@/features/trail-import/components/proposal-map", () => ({
  ProposalMap: () => <div data-testid="proposal-map" />,
}));

import TrailImportReviewPage from "./trail-import-review";

const SESSION = "/api/v1/admin/trail-import/sessions/1";
const PROPOSALS = `${SESSION}/proposals`;
const BULK = `${SESSION}/decide-bulk`;
const DIFF = `${SESSION}/diff`;
const APPLY = `${SESSION}/apply`;
const TRAILS = "/api/v1/admin/trails";

const certain = proposal({ id: 1, featureName: "Kranslingan", confidence: "Certain" });
const high = proposal({ id: 2, featureName: "Rya åsar", confidence: "High" });
const medium = proposal({ id: 3, featureName: "Vinkelleden", confidence: "Medium" });

let rows: Proposal[] = [];
let current: Session = session();
let claimedTotal: number | undefined;

const calls = (method: string, path: string) =>
  api.mock.calls.filter((call) => call.method === method && call.path === path);

const lastListParams = () => new URL(calls("GET", PROPOSALS).at(-1)?.url ?? PROPOSALS, "http://x").searchParams;

function Location() {
  const { search } = useLocation();
  return <output data-testid="location">{search}</output>;
}

function renderPage(proposals: Proposal[], options: { total?: number; url?: string; session?: Partial<Session> } = {}) {
  rows = proposals;
  claimedTotal = options.total;
  current = session(options.session);

  for (const row of proposals) {
    api.mock.on("GET", `${PROPOSALS}/${row.id}/preview`, () => preview({ proposalId: row.id }));
    api.mock.on("POST", `${PROPOSALS}/${row.id}/decide`, (body) => {
      const { decision } = body as { decision: string };
      rows = rows.map((r) => (r.id === row.id ? { ...r, decision } : r));
      return undefined;
    });
  }

  renderWithProviders(
    <>
      <TrailImportReviewPage />
      <Location />
    </>,
    { initialEntries: [options.url ?? "/trail-import/1"], path: "/trail-import/:sessionId" },
  );
}

const select = (name: string) => screen.getByRole("checkbox", { name: `Select ${name}` });
const acceptSelected = () => screen.getByRole("button", { name: /Accept selected/ });
const listed = () => screen.getAllByTestId("proposal-row").map((row) => within(row).getAllByRole("button").at(-1));
const selectedRow = () =>
  screen.getAllByTestId("proposal-row").find((row) => row.getAttribute("aria-current") === "true");

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();

  api.mock.on("GET", SESSION, () => current);
  api.mock.on("GET", TRAILS, () => []);
  api.mock.on("GET", PROPOSALS, () => {
    const params = lastListParams();
    const confidence = params.get("confidence");
    const decision = params.get("decision");
    const items = rows.filter(
      (r) => (!confidence || r.confidence === confidence) && (!decision || r.decision === decision),
    );
    const totalCount = claimedTotal ?? items.length;
    return { items, page: 1, totalCount, hasMore: totalCount > items.length };
  });
  api.mock.on("POST", BULK, (body) => {
    const { proposalIds } = body as { proposalIds: number[] };
    return { decided: proposalIds.length };
  });
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

    expect(acceptSelected()).toHaveAttribute("title", expect.stringContaining("only for Certain and High"));
  });

  it("decides exactly the rows that were selected, then clears the selection", async () => {
    renderPage([certain, high, medium]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Kranslingan" }));
    await userEvent.click(select("Rya åsar"));
    await userEvent.click(acceptSelected());

    await waitFor(() => expect(calls("POST", BULK)[0]?.body).toEqual({ proposalIds: [1, 2], decision: "Accept" }));
    expect(toasts.success).toHaveBeenCalledWith("2 proposal(s) set to Accept.");
    await waitFor(() => expect(screen.queryByRole("button", { name: /Accept selected/ })).not.toBeInTheDocument());
  });

  it("clears the selection without deciding anything", async () => {
    renderPage([certain, high]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Kranslingan" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByRole("button", { name: /Accept selected/ })).not.toBeInTheDocument();
    expect(calls("POST", BULK)).toHaveLength(0);
  });
});

describe("select all matching", () => {
  it("is not offered until the page in view is fully selected", async () => {
    renderPage([certain, high], { total: 203 });

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Kranslingan" }));

    expect(screen.queryByRole("button", { name: /Select all 203 matching/ })).not.toBeInTheDocument();
  });

  it("is offered once the page is exhausted and the filter holds more", async () => {
    renderPage([certain, high], { total: 203 });

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select every proposal on this page" }));

    expect(screen.getByRole("button", { name: /Select all 203 matching/ })).toBeInTheDocument();
  });

  it("is not offered when the page in view is already everything", async () => {
    renderPage([certain, high]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Select every proposal on this page" }));

    expect(screen.queryByRole("button", { name: /Select all/ })).not.toBeInTheDocument();
  });

  it("selects every matching row across the pages, under the same filter", async () => {
    renderPage([certain, high], { total: 3, url: "/trail-import/1?confidence=High" });
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select every proposal on this page" }));
    api.mock.on("GET", PROPOSALS, () => ({ items: [certain, high, medium], page: 1, totalCount: 3, hasMore: false }));

    await userEvent.click(screen.getByRole("button", { name: /Select all 3 matching/ }));

    expect(await screen.findByText("3 selected")).toBeInTheDocument();
    expect(lastListParams().get("pageSize")).toBe("200");
    expect(lastListParams().get("confidence")).toBe("High");
  });

  // The walk is bounded; a run that stopped short must leave the selection alone rather
  // than present a subset as the whole filter.
  it("leaves the selection untouched when the walk could not finish", async () => {
    renderPage([certain, high], { total: 203 });
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select every proposal on this page" }));
    // Every page claims there is another, so the walk runs into its ceiling.
    api.mock.on("GET", PROPOSALS, () => ({ items: [certain], page: 1, totalCount: 203, hasMore: true }));

    await userEvent.click(screen.getByRole("button", { name: /Select all 203 matching/ }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    // Still 2 — the incomplete walk did not replace the selection with its one row.
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
  });
});

describe("filters", () => {
  it("shows the undecided rows by default", async () => {
    renderPage([certain]);

    await screen.findByRole("checkbox", { name: "Select Kranslingan" });

    expect(lastListParams().get("decision")).toBe("Pending");
  });

  it("narrows on a confidence tier and keeps it in the address", async () => {
    renderPage([certain, high]);
    await screen.findByRole("checkbox", { name: "Select Kranslingan" });

    await userEvent.click(screen.getByRole("button", { name: /^1\s*High$/ }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("confidence=High"));
    expect(lastListParams().get("confidence")).toBe("High");
    expect(screen.getByText(/Showing High · Undecided/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^1\s*High$/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("asks for every decision when All is picked, and goes back to the first page", async () => {
    renderPage([certain], { url: "/trail-import/1?page=3" });
    await screen.findByRole("checkbox", { name: "Select Kranslingan" });

    await userEvent.click(screen.getByRole("button", { name: "All" }));

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("?decision=All"));
    await waitFor(() => expect(lastListParams().get("page")).toBe("1"));
    expect(lastListParams().has("decision")).toBe(false);
  });

  it("starts from the filters in the address", async () => {
    renderPage([medium], { url: "/trail-import/1?confidence=Medium&decision=All" });

    await screen.findByRole("checkbox", { name: "Select Vinkelleden" });

    expect(lastListParams().get("confidence")).toBe("Medium");
    expect(lastListParams().has("decision")).toBe(false);
  });

  it("explains an empty list in terms of the filters, and offers to show everything", async () => {
    renderPage([certain], { url: "/trail-import/1?confidence=Medium" });

    expect(await screen.findByText("No proposal is both Medium and Undecided.")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Show all" })[0]);

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("?decision=All"));
    expect(await screen.findByRole("checkbox", { name: "Select Kranslingan" })).toBeInTheDocument();
  });
});

describe("reviewing row by row", () => {
  it("steps through the list with j and k", async () => {
    renderPage([certain, high]);
    await screen.findByRole("checkbox", { name: "Select Kranslingan" });
    expect(selectedRow()).toHaveTextContent("Kranslingan");

    await userEvent.keyboard("j");
    expect(selectedRow()).toHaveTextContent("Rya åsar");

    await userEvent.keyboard("k");
    expect(selectedRow()).toHaveTextContent("Kranslingan");
  });

  it("opens the row that was clicked", async () => {
    renderPage([certain, high]);
    await screen.findByRole("checkbox", { name: "Select Kranslingan" });

    const [, second] = listed();
    if (!second) throw new Error("expected a second row");
    await userEvent.click(second);

    expect(selectedRow()).toHaveTextContent("Rya åsar");
    expect(await screen.findByRole("heading", { name: "Rya åsar" })).toBeInTheDocument();
  });

  it("moves on to the next row after a decision, not back to the top", async () => {
    renderPage([certain, high, medium]);
    await screen.findByRole("checkbox", { name: "Select Kranslingan" });
    await userEvent.keyboard("j");
    await screen.findByRole("heading", { name: "Rya åsar" });

    await userEvent.keyboard("x");

    expect(await screen.findByRole("heading", { name: "Vinkelleden" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId("proposal-row")).toHaveLength(2));
    expect(selectedRow()).toHaveTextContent("Vinkelleden");
  });

  it("refreshes the session's counts after a decision", async () => {
    renderPage([certain]);
    await screen.findByRole("heading", { name: "Kranslingan" });
    const before = calls("GET", SESSION).length;

    await userEvent.keyboard("x");

    await waitFor(() => expect(calls("GET", SESSION).length).toBeGreaterThan(before));
  });
});

describe("an applied session", () => {
  const appliedSession = { status: "Applied", appliedAt: "2026-08-01T10:00:00Z" };

  it("shows every decision by default, since none is pending any more", async () => {
    renderPage([{ ...certain, decision: "Accept" }], { session: appliedSession });

    await screen.findByRole("heading", { name: "Kranslingan" });

    expect(lastListParams().has("decision")).toBe(false);
  });

  it("offers nothing to select or decide", async () => {
    renderPage([{ ...certain, decision: "Accept" }], { session: appliedSession });

    await screen.findByRole("heading", { name: "Kranslingan" });

    expect(screen.queryByRole("checkbox", { name: "Select Kranslingan" })).toBeNull();
    expect(screen.queryByLabelText("Note")).toBeNull();
    expect(screen.queryByText(/step ·/)).toBeNull();
  });
});

describe("applying", () => {
  it("refreshes the trail list once the run has written to it", async () => {
    renderPage([certain]);
    api.mock.on("GET", DIFF, () => diff({ linksToWrite: 1 }));
    api.mock.on("POST", APPLY, () => ({
      sessionId: 1,
      status: "Applied",
      appliedAt: "2026-08-01T10:00:00Z",
      trailsCreated: 0,
      trailsUpdated: 1,
      linksWritten: 1,
      featuresExcluded: 0,
      trailsLinked: 1,
      conflicts: [],
    }));
    await screen.findByRole("heading", { name: "Kranslingan" });
    const before = calls("GET", TRAILS).length;

    await userEvent.click(screen.getByRole("button", { name: /Review what applying would write/ }));
    await userEvent.click(await screen.findByRole("button", { name: /^Apply / }));

    await waitFor(() => expect(calls("GET", TRAILS).length).toBeGreaterThan(before));
  });
});
