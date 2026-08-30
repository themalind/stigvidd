// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { Diff, Session } from "@/api/trail-import";
import { ApplyPanel } from "./apply-panel";

const api = vi.hoisted(() => ({
  getDiff: vi.fn(),
  applySession: vi.fn(),
}));
vi.mock("@/api/trail-import", () => api);

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    fileName: "boras-2026.geojson",
    status: "AwaitingReview",
    ...overrides,
  } as Session;
}

function diff(overrides: Partial<Diff> = {}): Diff {
  return {
    trailsToCreate: 2,
    trailsToUpdate: 3,
    linksToWrite: 41,
    featuresExcluded: 1,
    featuresPending: 0,
    featuresSkipped: 0,
    canApply: true,
    againstStrongMatch: [],
    withoutSegment: [],
    ...overrides,
  } as Diff;
}

function renderPanel(props: Partial<Parameters<typeof ApplyPanel>[0]> = {}) {
  const onApplied = vi.fn();

  render(
    <MemoryRouter>
      <ApplyPanel
        session={session()}
        onApplied={onApplied}
        onShowCreated={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );

  return { onApplied };
}

const applyButton = () => screen.queryByRole("button", { name: /^Apply / });

describe("ApplyPanel", () => {
  beforeEach(() => {
    api.getDiff.mockResolvedValue(diff());
    api.applySession.mockResolvedValue({
      trailsCreated: 2,
      trailsUpdated: 3,
      linksWritten: 41,
    });
  });

  // The gate the whole panel exists for: apply is the only call in the sync that changes
  // Trails, and there is no undo behind it.
  it("offers no apply button before the diff has been read", () => {
    renderPanel();

    expect(applyButton()).not.toBeInTheDocument();
    expect(api.getDiff).not.toHaveBeenCalled();
  });

  it("reveals what applying would write once the diff is read", async () => {
    renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: /Review what applying would write/ }),
    );

    expect(await screen.findByText("What applying would write")).toBeInTheDocument();
    expect(applyButton()).toBeEnabled();
  });

  it("names the number of decisions on the button, so the click is not blind", async () => {
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /Review what applying/ }));

    expect(await screen.findByRole("button", { name: "Apply 41 decision(s)" })).toBeVisible();
  });

  it("keeps apply out of reach when the server says the session cannot be applied", async () => {
    api.getDiff.mockResolvedValue(
      diff({ canApply: false, blockedReason: "Analysis has not finished." }),
    );
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /Review what applying/ }));

    expect(await screen.findByText("Analysis has not finished.")).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();
  });

  it("writes when apply is clicked", async () => {
    const { onApplied } = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /Review what applying/ }));
    await userEvent.click(await screen.findByRole("button", { name: /^Apply / }));

    await waitFor(() => expect(api.applySession).toHaveBeenCalledWith(1));
    expect(onApplied).toHaveBeenCalledOnce();
  });

  // Two clicks on an irreversible write must not be two writes.
  it("sends one request however fast the button is clicked twice", async () => {
    let release: (value: unknown) => void = () => {};
    api.applySession.mockReturnValue(new Promise((resolve) => (release = resolve)));
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /Review what applying/ }));
    const apply = await screen.findByRole("button", { name: /^Apply / });
    await userEvent.click(apply);

    expect(apply).toBeDisabled();
    await userEvent.click(apply);
    expect(api.applySession).toHaveBeenCalledOnce();

    release({ trailsCreated: 0, trailsUpdated: 0, linksWritten: 0 });
  });

  it("does not report a session as applied when the write failed", async () => {
    api.applySession.mockRejectedValue(new Error("HTTP error 500"));
    const { onApplied } = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /Review what applying/ }));
    await userEvent.click(await screen.findByRole("button", { name: /^Apply / }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    expect(onApplied).not.toHaveBeenCalled();
  });

  it("leaves the diff closed when it could not be read, so apply never appears", async () => {
    api.getDiff.mockRejectedValue(new Error("HTTP error 503"));
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /Review what applying/ }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    expect(applyButton()).not.toBeInTheDocument();
  });

  describe("warnings", () => {
    it("shows the decisions that go against a strong match", async () => {
      api.getDiff.mockResolvedValue(
        diff({
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
        } as Partial<Diff>),
      );
      renderPanel();

      await userEvent.click(screen.getByRole("button", { name: /Review what applying/ }));

      expect(
        await screen.findByText(/1 decision\(s\) go against a strong match/),
      ).toBeInTheDocument();
      expect(screen.getByText("Kranslingan")).toBeInTheDocument();
    });

    it("shows the trails that would be left with no segment", async () => {
      api.getDiff.mockResolvedValue(
        diff({
          withoutSegment: [
            { trailId: 4, trailName: "Sjuhäradsleden", duplicateLinks: 2 },
          ],
        } as Partial<Diff>),
      );
      renderPanel();

      await userEvent.click(screen.getByRole("button", { name: /Review what applying/ }));

      expect(
        await screen.findByText(/1 trail\(s\) would be left with no segment/),
      ).toBeInTheDocument();
    });

    // A warning must not double as a block: these are for a human to weigh, and the
    // server's canApply is the only thing that decides.
    it("still allows apply, because a warning is not a refusal", async () => {
      api.getDiff.mockResolvedValue(
        diff({
          withoutSegment: [
            { trailId: 4, trailName: "Sjuhäradsleden", duplicateLinks: 2 },
          ],
        } as Partial<Diff>),
      );
      renderPanel();

      await userEvent.click(screen.getByRole("button", { name: /Review what applying/ }));

      expect(await screen.findByRole("button", { name: /^Apply / })).toBeEnabled();
    });
  });

  describe("an applied session", () => {
    const appliedSession = session({
      status: "Applied",
      appliedAt: "2026-08-01T10:00:00Z",
      applied: {
        sessionId: 1,
        status: "Applied",
        trailsCreated: 2,
        trailsUpdated: 3,
        linksWritten: 41,
        featuresExcluded: 1,
        conflicts: [],
      },
    });

    it("cannot be applied again", () => {
      renderPanel({ session: appliedSession });

      expect(applyButton()).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Review what applying/ }),
      ).not.toBeInTheDocument();
    });

    it("reads back what the run wrote", () => {
      renderPanel({ session: appliedSession });

      expect(screen.getByText("Applied")).toBeInTheDocument();
      expect(screen.getByText("trails created")).toBeInTheDocument();
      expect(screen.getByText("41")).toBeInTheDocument();
    });

    it("says so plainly when a session was applied before the run was recorded", () => {
      renderPanel({ session: session({ status: "Applied" }) });

      expect(
        screen.getByText(/applied before the run was recorded/),
      ).toBeInTheDocument();
      expect(applyButton()).not.toBeInTheDocument();
    });
  });
});
