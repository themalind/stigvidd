// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryBoundary } from "@/components/query-boundary";
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

import UserWalksPage from "./user-walks";

const TRAILS = "/api/v1/admin/trails";

function renderPage() {
  return renderWithProviders(
    <QueryBoundary>
      <UserWalksPage />
    </QueryBoundary>,
    { initialEntries: ["/user-walks"] },
  );
}

beforeEach(() => {
  api.mock.reset();
  api.mock.on("GET", TRAILS, () => [
    trailListItem(),
    trailListItem({
      identifier: "walk-1",
      name: "Runt sjön",
      contribution: {
        submitterNickName: "VandrarVennen",
        showSubmitterName: false,
        publishedAt: "2026-10-01T00:00:00Z",
        likeCount: 3,
        submissionIdentifier: "submission-1",
      },
    }),
    trailListItem({
      identifier: "walk-2",
      name: "Skogsrundan",
      contribution: { showSubmitterName: true, publishedAt: "2026-09-01T00:00:00Z", likeCount: 0 },
    }),
  ]);
});

describe("the user walk list", () => {
  it("lists only walks published from a hike submission", async () => {
    renderPage();

    expect(await screen.findByText("2 of 2 user walks")).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Knalleleden/ })).not.toBeInTheDocument();
  });

  it("shows who submitted the walk, when it was published and its likes", async () => {
    renderPage();

    const row = within(await screen.findByRole("row", { name: /Runt sjön/ }));
    expect(row.getByText("VandrarVennen")).toBeInTheDocument();
    expect(row.getByText(/not named in the app/)).toBeInTheDocument();
    expect(row.getByText("2026-10-01")).toBeInTheDocument();
    expect(row.getByText("3")).toBeInTheDocument();
  });

  it("links to the submission the walk came from", async () => {
    renderPage();

    const row = within(await screen.findByRole("row", { name: /Runt sjön/ }));
    expect(row.getByRole("link", { name: "Open submission" })).toHaveAttribute(
      "href",
      "/hike-submissions/submission-1",
    );
  });

  it("says so when the submitter's account and submission are gone", async () => {
    renderPage();

    const row = within(await screen.findByRole("row", { name: /Skogsrundan/ }));
    expect(row.getByText("Deleted account")).toBeInTheDocument();
    expect(row.getByText("Removed")).toBeInTheDocument();
    expect(row.queryByRole("link", { name: "Open submission" })).not.toBeInTheDocument();
  });

  it("narrows the list by search", async () => {
    renderPage();
    await screen.findByText("2 of 2 user walks");

    await userEvent.type(screen.getByLabelText("Search user walks"), "skog");

    expect(screen.getByText("1 of 2 user walks")).toBeInTheDocument();
  });
});
