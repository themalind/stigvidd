// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DecideProposalRequest } from "@/api/generated/model";
import type { Preview, Proposal } from "@/features/trail-import/api/trail-import";
import { preview, proposal } from "@/testing/fixtures/trail-import";
import { renderWithProviders } from "@/testing/render";
import type { RelinkTarget } from "./relink-picker";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const toasted = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasted }));

vi.mock("./proposal-map", () => ({
  ProposalMap: () => <div data-testid="proposal-map" />,
}));

import { ProposalDetail } from "./proposal-detail";

const PROPOSAL = "/api/v1/admin/trail-import/sessions/11/proposals/7";

const server = {
  getPreview: vi.fn<() => Preview>(),
  decideProposal: vi.fn<(body: DecideProposalRequest) => void>(),
};

const trails: RelinkTarget[] = [
  { identifier: "t-1", name: "Sjuhäradsrundan", trailLength: 59 },
  { identifier: "t-2", name: "Knalleleden", trailLength: 42 },
];

const onDecided = vi.fn();

function show(
  over: {
    proposal?: Partial<Proposal>;
    preview?: Partial<Preview>;
    readOnly?: boolean;
  } = {},
) {
  server.getPreview.mockReturnValue(preview(over.preview));

  return renderWithProviders(
    <ProposalDetail
      sessionId={11}
      proposal={proposal(over.proposal)}
      trails={trails}
      onDecided={onDecided}
      readOnly={over.readOnly}
    />,
  );
}

const drawn = () => screen.findByTestId("proposal-map");
const button = (name: RegExp | string) => screen.getByRole("button", { name });
const saved = () => server.decideProposal.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  api.mock.on("GET", `${PROPOSAL}/preview`, () => server.getPreview());
  api.mock.on("POST", `${PROPOSAL}/decide`, (body) => server.decideProposal(body as DecideProposalRequest));
});

describe("the link to the source's own page", () => {
  const withLink = (properties: string | null) => show({ preview: { featureProperties: properties } });

  it("offers the municipality's page for the feature", async () => {
    withLink(JSON.stringify({ link: "https://boras.se/leder/knalleleden" }));
    await drawn();

    expect(screen.getByRole("link", { name: /Source page/ })).toHaveAttribute(
      "href",
      "https://boras.se/leder/knalleleden",
    );
  });

  // The properties come straight from the municipality's export, and the reviewer clicks
  // the link. Only the two web schemes may reach an href.
  it("refuses a javascript: link from the source data", async () => {
    withLink(JSON.stringify({ link: "javascript:alert(document.cookie)" }));
    await drawn();

    expect(screen.queryByRole("link", { name: /Source page/ })).toBeNull();
  });

  it("refuses a data: link too", async () => {
    withLink(JSON.stringify({ link: "data:text/html,<script>x</script>" }));
    await drawn();

    expect(screen.queryByRole("link", { name: /Source page/ })).toBeNull();
  });

  it("offers nothing when the link is not a string", async () => {
    withLink(JSON.stringify({ link: { href: "https://boras.se" } }));
    await drawn();

    expect(screen.queryByRole("link", { name: /Source page/ })).toBeNull();
  });

  // A single-element array stringifies to its element, so this one reaches new URL()
  // intact and only the typeof check keeps it out.
  it("offers nothing for a link wrapped in an array", async () => {
    withLink(JSON.stringify({ link: ["https://boras.se/leder"] }));
    await drawn();

    expect(screen.queryByRole("link", { name: /Source page/ })).toBeNull();
  });

  it("survives properties that are not JSON at all", async () => {
    withLink("not json");
    await drawn();

    expect(screen.queryByRole("link", { name: /Source page/ })).toBeNull();
  });

  it("survives a link that is not a URL", async () => {
    withLink(JSON.stringify({ link: "boras.se/leder" }));
    await drawn();

    expect(screen.queryByRole("link", { name: /Source page/ })).toBeNull();
  });
});

describe("Accept", () => {
  it("links the feature to the suggested trail", async () => {
    show();
    await drawn();

    await userEvent.click(button(/^Accept$/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalledOnce());
    expect(saved()).toMatchObject({ decision: "Accept", role: "Segment" });
    await waitFor(() => expect(onDecided).toHaveBeenCalled());
  });

  // Accepting means "the match the analysis found is right". With nothing suggested there
  // is no match to keep, and the row would be decided against no trail at all.
  it("is out of reach when nothing was suggested", async () => {
    show({ proposal: { suggestedTrailId: null, suggestedTrailName: null } });
    await drawn();

    expect(button(/^Accept$/)).toBeDisabled();
  });

  it("says so rather than deciding when the shortcut is pressed with no suggestion", async () => {
    show({ proposal: { suggestedTrailId: null } });
    await drawn();

    await userEvent.keyboard("a");

    expect(toasted.error).toHaveBeenCalledWith(
      "Nothing was suggested for this feature. Relink it or create a new trail.",
    );
    expect(server.decideProposal).not.toHaveBeenCalled();
  });

  it("accepts with the shortcut", async () => {
    show();
    await drawn();

    await userEvent.keyboard("a");

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalledOnce());
    expect(saved()).toMatchObject({ decision: "Accept", role: "Segment" });
  });

  // Pressing it again would save the same row and step on, which reads as a flinch.
  it("is settled once it has been accepted as it stands", async () => {
    show({ proposal: { decision: "Accept", decidedRole: "Segment" } });
    await drawn();

    expect(button(/Accepted/)).toBeDisabled();
  });

  it("comes back within reach when the role is changed", async () => {
    show({ proposal: { decision: "Accept", decidedRole: "Segment" } });
    await drawn();

    await userEvent.click(screen.getByRole("radio", { name: /Duplicate/ }));

    expect(button(/^Accept$/)).toBeEnabled();
  });

  it("reopens a decided proposal on the role it was given", async () => {
    show({ proposal: { decision: "Accept", decidedRole: "Duplicate" } });
    await drawn();

    expect(screen.getByRole("radio", { name: /Duplicate/ })).toBeChecked();
  });

  it("does nothing when the shortcut repeats a decision already made", async () => {
    show({ proposal: { decision: "Accept", decidedRole: "Segment" } });
    await drawn();

    await userEvent.keyboard("a");

    expect(server.decideProposal).not.toHaveBeenCalled();
  });
});

describe("the note", () => {
  it("goes with the decision", async () => {
    show();
    await drawn();

    await userEvent.type(screen.getByLabelText("Note"), "Signed on site");
    await userEvent.click(button(/^Accept$/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved().note).toBe("Signed on site");
  });

  it("is left out when it is only whitespace", async () => {
    show();
    await drawn();

    await userEvent.type(screen.getByLabelText("Note"), "   ");
    await userEvent.click(button(/^Accept$/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved().note).toBeUndefined();
  });

  it("starts from the note the row already carries", async () => {
    show({ proposal: { note: "Checked against the map" } });
    await drawn();

    expect(screen.getByLabelText("Note")).toHaveValue("Checked against the map");
  });

  it("takes no shortcut from what is typed into it", async () => {
    show();
    await drawn();

    await userEvent.type(screen.getByLabelText("Note"), "axsu");

    expect(server.decideProposal).not.toHaveBeenCalled();
  });
});

describe("Exclude, Skip and Undo", () => {
  it("excludes without a role, since it links to no trail", async () => {
    show();
    await drawn();

    await userEvent.click(button(/^Exclude$/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved().decision).toBe("Exclude");
    expect(saved().role).toBeUndefined();
  });

  it("skips without a role either", async () => {
    show();
    await drawn();

    await userEvent.click(button(/^Skip$/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved()).toMatchObject({ decision: "Skip" });
    expect(saved().role).toBeUndefined();
  });

  it.each([
    ["x", "Exclude"],
    ["s", "Skip"],
  ])("decides with the %s shortcut", async (key, decision) => {
    show();
    await drawn();

    await userEvent.keyboard(key);

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalledOnce());
    expect(saved().decision).toBe(decision);
  });

  it("offers no Undo on a row that was never decided", async () => {
    show();
    await drawn();

    expect(screen.queryByRole("button", { name: /Undo/ })).toBeNull();
  });

  // Undoing a row that was never decided would report a decision that did not happen.
  it("ignores the Undo shortcut on a pending row", async () => {
    show();
    await drawn();

    await userEvent.keyboard("u");

    expect(server.decideProposal).not.toHaveBeenCalled();
  });

  it("clears a decision that was made", async () => {
    show({ proposal: { decision: "Exclude" } });
    await drawn();

    await userEvent.click(button(/Undo/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved().decision).toBe("Pending");
  });

  it("undoes a decision with the shortcut", async () => {
    show({ proposal: { decision: "Skip" } });
    await drawn();

    await userEvent.keyboard("u");

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalledOnce());
    expect(saved().decision).toBe("Pending");
  });

  it("ignores a shortcut that repeats the exclusion already recorded", async () => {
    show({ proposal: { decision: "Exclude" } });
    await drawn();

    await userEvent.keyboard("x");

    expect(server.decideProposal).not.toHaveBeenCalled();
  });
});

// A keypress must never be the whole of an irreversible decision: these two open a panel.
describe("the shortcuts that only open a panel", () => {
  it("opens the trail picker for Relink rather than relinking", async () => {
    show();
    await drawn();

    await userEvent.keyboard("r");

    expect(await screen.findByLabelText("Link to another trail")).toBeVisible();
    expect(server.decideProposal).not.toHaveBeenCalled();
  });

  it("opens the naming panel for a new trail rather than creating one", async () => {
    show();
    await drawn();

    await userEvent.keyboard("n");

    expect(await screen.findByLabelText("Name for the new trail")).toBeVisible();
    expect(server.decideProposal).not.toHaveBeenCalled();
  });
});

describe("Relink", () => {
  it("links to the trail that was picked, with the chosen role", async () => {
    show();
    await drawn();

    await userEvent.click(button(/^Relink$/));
    await userEvent.type(screen.getByLabelText("Link to another trail"), "sjuhärad");
    await userEvent.click(button(/Sjuhäradsrundan/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved()).toMatchObject({
      decision: "Relink",
      trailIdentifier: "t-1",
      role: "Segment",
    });
  });

  it("searches by name, ignoring case", async () => {
    show();
    await drawn();

    await userEvent.click(button(/^Relink$/));
    await userEvent.type(screen.getByLabelText("Link to another trail"), "KNALLE");

    expect(screen.getByRole("button", { name: /Knalleleden/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Sjuhärad/ })).toBeNull();
  });

  it("says when nothing matches instead of offering the wrong trail", async () => {
    show();
    await drawn();

    await userEvent.click(button(/^Relink$/));
    await userEvent.type(screen.getByLabelText("Link to another trail"), "zzz");

    expect(screen.getByText("No trail matches that.")).toBeVisible();
  });

  it("says so when the trail list could not be loaded", async () => {
    server.getPreview.mockReturnValue(preview());
    renderWithProviders(
      <ProposalDetail sessionId={11} proposal={proposal()} trails={undefined} onDecided={onDecided} />,
    );
    await drawn();

    await userEvent.click(button(/^Relink$/));

    expect(screen.getByText("The trail list is not available.")).toBeVisible();
  });
});

describe("a new trail", () => {
  const openPanel = async () => {
    await userEvent.click(button(/New trail/));
    return screen.findByLabelText("Name for the new trail");
  };

  it("starts from the source's name, which is the only place the import writes one", async () => {
    show();
    await drawn();

    expect(await openPanel()).toHaveValue("Knalleleden etapp 2");
  });

  it("starts from the name already decided, when there is one", async () => {
    show({ proposal: { decidedName: "Knalleleden norr" } });
    await drawn();

    expect(await openPanel()).toHaveValue("Knalleleden norr");
  });

  it("cannot be created without a name", async () => {
    show();
    await drawn();
    const name = await openPanel();

    await userEvent.clear(name);

    expect(button(/Create trail/)).toBeDisabled();
  });

  it("takes the length measured from the line by default", async () => {
    show();
    await drawn();
    await openPanel();

    await userEvent.click(button(/Create trail/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved()).toMatchObject({
      decision: "CreateNew",
      name: "Knalleleden etapp 2",
      lengthKm: 6.2,
    });
  });

  it("sends no role, since a new trail has nothing to be a segment of yet", async () => {
    show();
    await drawn();
    await openPanel();

    await userEvent.click(button(/Create trail/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved().role).toBeUndefined();
  });

  // Only worth offering when the two disagree; otherwise the measurement is the answer.
  it("offers the stated length only when it disagrees with the line", async () => {
    show({ preview: { sourceLengthDisagrees: true, sourceStatedLengthKm: 9 } });
    await drawn();
    await openPanel();

    await userEvent.click(screen.getByRole("radio", { name: /what the source states/ }));
    await userEvent.click(button(/Create trail/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved().lengthKm).toBe(9);
  });

  it("does not offer a choice when the two agree", async () => {
    show();
    await drawn();
    await openPanel();

    expect(screen.queryByRole("radio", { name: /what the source states/ })).toBeNull();
  });

  it("trims the name it was given", async () => {
    show();
    await drawn();
    const name = await openPanel();

    await userEvent.clear(name);
    await userEvent.type(name, "  Knalleleden norr  ");
    await userEvent.click(button(/Create trail/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved().name).toBe("Knalleleden norr");
  });

  it("closes once the trail is decided", async () => {
    show();
    await drawn();
    await openPanel();

    await userEvent.click(button(/Create trail/));

    await waitFor(() => expect(screen.queryByLabelText("Name for the new trail")).toBeNull());
  });
});

/**
 * A trail's route is built from the features linked to it as segments. Two segments
 * covering the same ground would merge into one doubled line, so the panel offers whichever
 * role the trail is still missing.
 */
describe("features that point at the same trail", () => {
  const sibling = (over = {}) => ({
    proposalId: 9,
    featureName: "Knalleleden etapp 1",
    decision: "Pending",
    decidedRole: "Segment",
    ...over,
  });

  it("says nothing when this feature is the only one", async () => {
    show();
    await drawn();

    expect(screen.queryByText(/point at the same trail/)).toBeNull();
    expect(screen.queryByText(/points at the same trail/)).toBeNull();
  });

  it("offers the segment role while no other feature carries the route", async () => {
    show({ preview: { sharingTheTrail: [sibling()] } });
    await drawn();

    await userEvent.click(button(/Accept as segment/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved()).toMatchObject({ decision: "Accept", role: "Segment" });
  });

  it("offers the duplicate role once another feature is carrying it", async () => {
    show({
      preview: {
        sharingTheTrail: [sibling({ decision: "Accept", decidedRole: "Segment" })],
      },
    });
    await drawn();

    await userEvent.click(button(/Accept as duplicate/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved()).toMatchObject({ decision: "Accept", role: "Duplicate" });
  });

  // A sibling that was excluded or left pending is not carrying anything.
  it("does not count an undecided sibling as the carrier", async () => {
    show({
      preview: {
        sharingTheTrail: [sibling({ decision: "Pending", decidedRole: "Segment" })],
      },
    });
    await drawn();

    expect(screen.getByRole("button", { name: /Accept as segment/ })).toBeVisible();
  });

  it("does not count a sibling accepted as a duplicate", async () => {
    show({
      preview: {
        sharingTheTrail: [sibling({ decision: "Accept", decidedRole: "Duplicate" })],
      },
    });
    await drawn();

    expect(screen.getByRole("button", { name: /Accept as segment/ })).toBeVisible();
  });

  it("counts a relinked segment as the carrier just as much as an accepted one", async () => {
    show({
      preview: {
        sharingTheTrail: [sibling({ decision: "Relink", decidedRole: "Segment" })],
      },
    });
    await drawn();

    expect(screen.getByRole("button", { name: /Accept as duplicate/ })).toBeVisible();
  });

  it("counts them in the warning", async () => {
    show({
      preview: {
        sharingTheTrail: [sibling(), sibling({ proposalId: 10, featureName: "etapp 3" })],
      },
    });
    await drawn();

    expect(screen.getByText(/2 other features/)).toBeVisible();
  });
});

/**
 * Rewriting the trail's curated length is the one thing here that changes a trail rather
 * than a link, and the curated lengths are ours — see the note on trail names.
 */
describe("rewriting the trail's length", () => {
  const gap = { trailCuratedLengthKm: 42, trailMeasuredLengthKm: 30 };

  it("is not offered when the two lengths agree", async () => {
    show();
    await drawn();

    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("is not offered for a difference under half a kilometre", async () => {
    show({ preview: { trailCuratedLengthKm: 42, trailMeasuredLengthKm: 42.4 } });
    await drawn();

    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  // Half a kilometre is a floor in its own right, not a share: the signs round to it, so
  // on a short trail a tenth of the length is well inside the rounding.
  it("is not offered for half a kilometre on a short trail", async () => {
    show({ preview: { trailCuratedLengthKm: 2, trailMeasuredLengthKm: 2.4 } });
    await drawn();

    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("is not offered for a difference under a tenth of the length", async () => {
    show({ preview: { trailCuratedLengthKm: 42, trailMeasuredLengthKm: 45 } });
    await drawn();

    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("is offered when the gap clears both thresholds", async () => {
    show({ preview: gap });
    await drawn();

    expect(screen.getByRole("checkbox")).toBeVisible();
  });

  // Unticked, the accept must carry no length at all: sending the measured figure anyway
  // would rewrite every curated length the reviewer walked past.
  it("sends no length while the box is unticked", async () => {
    show({ preview: gap });
    await drawn();

    await userEvent.click(button(/^Accept$/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved().lengthKm).toBeUndefined();
  });

  it("sends the measured length once it is ticked", async () => {
    show({ preview: gap });
    await drawn();

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(button(/^Accept$/));

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved().lengthKm).toBe(30);
  });

  it("sends the measured length from the shortcut as well as the button", async () => {
    show({ preview: gap });
    await drawn();

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.keyboard("a");

    await waitFor(() => expect(server.decideProposal).toHaveBeenCalled());
    expect(saved().lengthKm).toBe(30);
  });

  it("puts Accept back within reach on a row already accepted", async () => {
    show({ proposal: { decision: "Accept", decidedRole: "Segment" }, preview: gap });
    await drawn();

    await userEvent.click(screen.getByRole("checkbox"));

    expect(button(/^Accept$/)).toBeEnabled();
  });
});

describe("an applied session", () => {
  it("keeps the numbers and takes away the controls", async () => {
    show({ readOnly: true, proposal: { decision: "Accept" } });
    await drawn();

    expect(screen.getByText("Knalleleden etapp 2")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Accept$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Exclude$/ })).toBeNull();
    expect(screen.queryByLabelText("Note")).toBeNull();
  });

  it("takes the shortcuts away too", async () => {
    show({ readOnly: true });
    await drawn();

    await userEvent.keyboard("x");

    expect(server.decideProposal).not.toHaveBeenCalled();
  });
});

describe("when the preview cannot be loaded", () => {
  it("says so and still offers the decisions", async () => {
    server.getPreview.mockImplementation(() => {
      throw new Error("offline");
    });

    renderWithProviders(<ProposalDetail sessionId={11} proposal={proposal()} trails={trails} onDecided={onDecided} />);

    expect(await screen.findByText("No preview available.")).toBeVisible();
    expect(screen.getByText("offline")).toBeVisible();
    expect(button(/^Exclude$/)).toBeEnabled();
  });
});

describe("when the decision cannot be saved", () => {
  it("reports it and does not tell the page to move on", async () => {
    show();
    server.decideProposal.mockImplementation(() => {
      throw new Error("Session already applied.");
    });
    await drawn();

    await userEvent.click(button(/^Accept$/));

    await waitFor(() => expect(toasted.error).toHaveBeenCalledWith("Session already applied."));
    expect(onDecided).not.toHaveBeenCalled();
  });
});
