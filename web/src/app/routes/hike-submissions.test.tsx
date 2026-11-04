// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminHikeSubmissionListItemResponse } from "@/api/generated/model";
import { renderWithProviders } from "@/testing/render";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

import HikeSubmissionsPage from "./hike-submissions";

const LIST = "/api/v1/admin/hike-submissions";

function item(overrides: Partial<AdminHikeSubmissionListItemResponse> = {}): AdminHikeSubmissionListItemResponse {
  return {
    identifier: "sub-1",
    name: "Kvällsrunda",
    submitterNickName: "Vandraren",
    showSubmitterName: false,
    createdAt: "2026-10-20T09:00:00Z",
    trailLength: 3.2,
    imageCount: 0,
    status: "Pending",
    longestGapMetres: 12,
    ...overrides,
  };
}

let byStatus: Record<string, AdminHikeSubmissionListItemResponse[]> = {};

const requestedStatuses = () =>
  api.mock.calls
    .filter((call) => call.path === LIST)
    .map((call) => new URL(call.url, "http://x").searchParams.get("status"));

function renderPage(url = "/hike-submissions") {
  return renderWithProviders(<HikeSubmissionsPage />, { initialEntries: [url] });
}

beforeEach(() => {
  api.mock.reset();
  byStatus = {
    Pending: [item(), item({ identifier: "sub-2", name: "Hoppig", longestGapMetres: 840, imageCount: 3 })],
    Approved: [item({ identifier: "sub-3", name: "Publicerad", status: "Approved" })],
    Rejected: [],
  };
  api.mock.on("GET", LIST, () => {
    const status = new URL(api.mock.calls[api.mock.calls.length - 1].url, "http://x").searchParams.get("status");
    return byStatus[status ?? ""] ?? [];
  });
});

describe("the submission list", () => {
  it("opens on pending submissions and links each to its review", async () => {
    renderPage();

    const row = within(await screen.findByRole("row", { name: /Kvällsrunda/ }));
    expect(row.getByText("None, example images")).toBeInTheDocument();
    expect(row.getByText("(hidden)")).toBeInTheDocument();
    expect(row.getByRole("link", { name: "Review" })).toHaveAttribute("href", "/hike-submissions/sub-1");
    expect(requestedStatuses()).toEqual(["Pending"]);
  });

  it("flags a GPS jump worth checking", async () => {
    renderPage();

    expect(within(await screen.findByRole("row", { name: /Hoppig/ })).getByText("Jump of 840 m")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Kvällsrunda/ })).getByText("No jumps")).toBeInTheDocument();
  });

  it("switches status and offers to edit an approved walk", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Kvällsrunda");

    await user.click(screen.getByRole("tab", { name: "Approved" }));

    expect(await screen.findByRole("link", { name: "Edit" })).toHaveAttribute("href", "/hike-submissions/sub-3");
    expect(screen.getByRole("tab", { name: "Approved" })).toHaveAttribute("aria-selected", "true");
  });

  it("starts from the status in the address", async () => {
    renderPage("/hike-submissions?status=Rejected");

    expect(await screen.findByText("No rejected submissions.")).toBeInTheDocument();
    expect(requestedStatuses()).toEqual(["Rejected"]);
  });

  it("shows a failed load with a way to try again", async () => {
    const user = userEvent.setup();
    let fail = true;
    api.mock.on("GET", LIST, () => {
      if (fail) throw new Error("The list is down");
      return byStatus.Pending;
    });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("The list is down");

    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Kvällsrunda")).toBeInTheDocument();
  });
});
