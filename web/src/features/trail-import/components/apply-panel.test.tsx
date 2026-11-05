// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApplyResult, Diff } from "@/features/trail-import/api/trail-import";
import { diff, session } from "@/testing/fixtures/trail-import";
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

import { ApplyPanel } from "./apply-panel";

const SESSION = "/api/v1/admin/trail-import/sessions/1";
const DIFF = `${SESSION}/diff`;
const APPLY = `${SESSION}/apply`;

const applied: ApplyResult = {
  sessionId: 1,
  status: "Applied",
  appliedAt: "2026-08-01T10:00:00Z",
  trailsCreated: 2,
  trailsUpdated: 3,
  linksWritten: 41,
  featuresExcluded: 1,
  trailsLinked: 3,
  conflicts: [],
};

let served: Diff = diff();

const calls = (method: string, path: string) =>
  api.mock.calls.filter((call) => call.method === method && call.path === path);

function renderPanel(props: Partial<Parameters<typeof ApplyPanel>[0]> = {}) {
  const onApplied = vi.fn();

  renderWithProviders(<ApplyPanel session={session()} onApplied={onApplied} onShowCreated={vi.fn()} {...props} />, {
    initialEntries: ["/trail-import/1"],
  });

  return { onApplied };
}

const applyButton = () => screen.queryByRole("button", { name: /^Apply / });
const review = () => userEvent.click(screen.getByRole("button", { name: /Review what applying would write/ }));

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  served = diff();
  api.mock.on("GET", DIFF, () => served);
  api.mock.on("POST", APPLY, () => applied);
});

describe("ApplyPanel", () => {
  // The gate the whole panel exists for: apply is the only call in the sync that changes
  // Trails, and there is no undo behind it.
  it("offers no apply button before the diff has been read", () => {
    renderPanel();

    expect(applyButton()).not.toBeInTheDocument();
    expect(calls("GET", DIFF)).toHaveLength(0);
  });

  it("reveals what applying would write once the diff is read", async () => {
    renderPanel();

    await review();

    expect(await screen.findByText("What applying would write")).toBeInTheDocument();
    expect(applyButton()).toBeEnabled();
  });

  it("names the number of decisions on the button, so the click is not blind", async () => {
    renderPanel();

    await review();

    expect(await screen.findByRole("button", { name: "Apply 41 decision(s)" })).toBeVisible();
  });

  it("keeps apply out of reach when the server says the session cannot be applied", async () => {
    served = diff({ canApply: false, blockedReason: "Analysis has not finished." });
    renderPanel();

    await review();

    expect(await screen.findByText("Analysis has not finished.")).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();
  });

  it("reads the diff again each time it is opened", async () => {
    renderPanel();

    await review();
    await userEvent.click(await screen.findByRole("button", { name: "Close" }));
    served = diff({ linksToWrite: 7 });
    await review();

    expect(await screen.findByRole("button", { name: "Apply 7 decision(s)" })).toBeVisible();
    expect(calls("GET", DIFF)).toHaveLength(2);
  });

  it("writes when apply is clicked", async () => {
    const { onApplied } = renderPanel();

    await review();
    await userEvent.click(await screen.findByRole("button", { name: /^Apply / }));

    await waitFor(() => expect(calls("POST", APPLY)).toHaveLength(1));
    await waitFor(() => expect(onApplied).toHaveBeenCalledOnce());
    expect(toasts.success).toHaveBeenCalledWith("Applied: 2 created, 3 updated, 41 links written.");
  });

  // Two clicks on an irreversible write must not be two writes.
  it("sends one request however fast the button is clicked twice", async () => {
    let release: (value: ApplyResult) => void = () => {};
    api.mock.on("POST", APPLY, () => new Promise<ApplyResult>((resolve) => (release = resolve)));
    renderPanel();

    await review();
    const apply = await screen.findByRole("button", { name: /^Apply / });
    await userEvent.click(apply);

    await waitFor(() => expect(apply).toBeDisabled());
    await userEvent.click(apply);
    expect(calls("POST", APPLY)).toHaveLength(1);

    release(applied);
  });

  it("does not report a session as applied when the write failed", async () => {
    api.mock.on("POST", APPLY, () => {
      throw new Error("HTTP error 500");
    });
    const { onApplied } = renderPanel();

    await review();
    await userEvent.click(await screen.findByRole("button", { name: /^Apply / }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("The session could not be applied."));
    expect(onApplied).not.toHaveBeenCalled();
  });

  it("says so when the diff could not be read, and apply never appears", async () => {
    api.mock.on("GET", DIFF, () => {
      throw new Error("HTTP error 503");
    });
    renderPanel();

    await review();

    expect(await screen.findByRole("alert")).toHaveTextContent("The preview could not be read. HTTP error 503");
    expect(applyButton()).not.toBeInTheDocument();
  });

  it("reads it again from the same button after a failure", async () => {
    api.mock.on("GET", DIFF, () => {
      throw new Error("HTTP error 503");
    });
    renderPanel();
    await review();
    await screen.findByRole("alert");

    api.mock.on("GET", DIFF, () => served);
    await review();

    expect(await screen.findByRole("button", { name: /^Apply / })).toBeEnabled();
  });

  describe("warnings", () => {
    it("shows the decisions that go against a strong match", async () => {
      served = diff({
        againstStrongMatch: [
          {
            proposalId: 9,
            featureName: "Kranslingan",
            decision: "Exclude",
            confidence: "Certain",
            coverageForward: 0.97,
            trailName: "Kransl.",
          },
        ],
      });
      renderPanel();

      await review();

      expect(await screen.findByText(/1 decision\(s\) go against a strong match/)).toBeInTheDocument();
      expect(screen.getByText("Kranslingan")).toBeInTheDocument();
    });

    it("shows the trails that would be left with no segment", async () => {
      served = diff({ withoutSegment: [{ trailId: 4, trailName: "Sjuhäradsleden", duplicateLinks: 2 }] });
      renderPanel();

      await review();

      expect(await screen.findByText(/1 trail\(s\) would be left with no segment/)).toBeInTheDocument();
    });

    // A warning must not double as a block: these are for a human to weigh, and the
    // server's canApply is the only thing that decides.
    it("still allows apply, because a warning is not a refusal", async () => {
      served = diff({ withoutSegment: [{ trailId: 4, trailName: "Sjuhäradsleden", duplicateLinks: 2 }] });
      renderPanel();

      await review();

      expect(await screen.findByRole("button", { name: /^Apply / })).toBeEnabled();
    });
  });

  describe("an applied session", () => {
    const appliedSession = session({ status: "Applied", appliedAt: "2026-08-01T10:00:00Z", applied });

    it("cannot be applied again", () => {
      renderPanel({ session: appliedSession });

      expect(applyButton()).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Review what applying/ })).not.toBeInTheDocument();
    });

    it("reads back what the run wrote", () => {
      renderPanel({ session: appliedSession });

      expect(screen.getByText("Applied")).toBeInTheDocument();
      expect(screen.getByText("trails created")).toBeInTheDocument();
      expect(screen.getByText("41")).toBeInTheDocument();
    });

    it("lists the fields the source would have overwritten", () => {
      renderPanel({
        session: session({
          status: "Applied",
          applied: {
            ...applied,
            conflicts: [
              { trailId: 4, trailName: "Knalleleden", field: "Name", ours: "Knalleleden", theirs: "Knallel." },
            ],
          },
        }),
      });

      expect(screen.getByText(/1 field\(s\) the source would have overwritten/)).toBeInTheDocument();
      expect(screen.getByText(/source said “Knallel\.”/)).toBeInTheDocument();
    });

    it("explains a run that linked trails without changing them", () => {
      renderPanel({
        session: session({ status: "Applied", applied: { ...applied, trailsUpdated: 0, trailsLinked: 5 } }),
      });

      expect(screen.getByText(/5 existing trail\(s\) were linked without being changed/)).toBeInTheDocument();
    });

    it("says so plainly when a session was applied before the run was recorded", () => {
      renderPanel({ session: session({ status: "Applied" }) });

      expect(screen.getByText(/applied before the run was recorded/)).toBeInTheDocument();
      expect(applyButton()).not.toBeInTheDocument();
    });
  });
});
