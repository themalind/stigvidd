// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link } from "react-router";
import { ApiError } from "@/api/mutator";
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

const toasts = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => toasts);

import TrailsPage from "./trails";

const TRAILS = "/api/v1/admin/trails";
const VERIFIED = `${TRAILS}/trail-1/verified`;

function renderPage(url = "/trails") {
  return renderWithProviders(
    <QueryBoundary>
      <TrailsPage />
    </QueryBoundary>,
    { initialEntries: [url] },
  );
}

const rows = () => screen.getAllByRole("row").slice(1);
const toggle = () => screen.getByRole("checkbox", { name: "Active: Knalleleden" });

let stored = [trailListItem()];

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  stored = [
    trailListItem(),
    trailListItem({ identifier: "trail-2", name: "Ryaslingan", city: "Alingsås", isVerified: false, trailLength: 4 }),
  ];
  api.mock.on("GET", TRAILS, () => stored);
  api.mock.on("PUT", VERIFIED, (body) => {
    const { isVerified } = body as { isVerified: boolean };
    stored = stored.map((trail) => (trail.identifier === "trail-1" ? { ...trail, isVerified } : trail));
    return undefined;
  });
});

describe("the trail list", () => {
  it("shows every trail with its length, difficulty and date", async () => {
    renderPage();

    const row = within(await screen.findByRole("row", { name: /Knalleleden/ }));
    expect(row.getByText("42 km")).toBeInTheDocument();
    expect(row.getByText("Medium")).toBeInTheDocument();
    expect(row.getByText("2026-01-01")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 trails")).toBeInTheDocument();
  });

  it("narrows the list by search", async () => {
    renderPage();
    await screen.findByText("2 of 2 trails");

    await userEvent.type(screen.getByLabelText("Search trails"), "rya");

    expect(screen.getByText("1 of 2 trails")).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
    expect(screen.getByRole("row", { name: /Ryaslingan/ })).toBeInTheDocument();
  });

  it("starts from the filter in the address, so the dashboard can link to it", async () => {
    renderPage("/trails?status=Inactive");

    expect(await screen.findByText("1 of 2 trails")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Ryaslingan/ })).toBeInTheDocument();
  });

  it("clears every filter at once", async () => {
    renderPage("/trails?status=Inactive");
    await screen.findByText("1 of 2 trails");

    await userEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByText("2 of 2 trails")).toBeInTheDocument();
  });

  it("follows the address when a link changes it while the page is open", async () => {
    renderWithProviders(
      <QueryBoundary>
        <Link to="/trails">All trails</Link>
        <TrailsPage />
      </QueryBoundary>,
      { initialEntries: ["/trails?status=Inactive"] },
    );
    await screen.findByText("1 of 2 trails");

    await userEvent.click(screen.getByRole("link", { name: "All trails" }));

    expect(await screen.findByText("2 of 2 trails")).toBeInTheDocument();
  });
});

describe("activating and hiding a trail", () => {
  it("shows the trail's current state", async () => {
    renderPage();

    expect(await screen.findByRole("checkbox", { name: "Active: Ryaslingan" })).not.toBeChecked();
    expect(toggle()).toBeChecked();
  });

  it("hides an active trail before the server has answered", async () => {
    let answer = () => {};
    api.mock.on("PUT", VERIFIED, () => new Promise<void>((resolve) => (answer = resolve)));
    renderPage();
    await screen.findByText("2 of 2 trails");

    await userEvent.click(toggle());

    await waitFor(() => expect(toggle()).not.toBeChecked());
    expect(toasts.toast.success).not.toHaveBeenCalled();
    answer();
  });

  it("sends the new state and says so once saved", async () => {
    renderPage();
    await screen.findByText("2 of 2 trails");

    await userEvent.click(toggle());

    await waitFor(() => expect(toasts.toast.success).toHaveBeenCalledWith("Knalleleden is now hidden from the app."));
    expect(api.mock.calls.find((call) => call.method === "PUT")?.body).toEqual({ isVerified: false });
    expect(toggle()).not.toBeChecked();
  });

  it("keeps the filtered count in step with the change", async () => {
    renderPage("/trails?status=Active");
    await screen.findByText("1 of 2 trails");

    await userEvent.click(toggle());

    expect(await screen.findByText("0 of 2 trails")).toBeInTheDocument();
  });

  it("puts the old state back, and names the trail, when the server refuses", async () => {
    api.mock.on("PUT", VERIFIED, () => {
      throw new ApiError("Server error", 500);
    });
    let release = () => {};
    renderPage();
    await screen.findByText("2 of 2 trails");
    api.mock.on("GET", TRAILS, () => new Promise((resolve) => (release = () => resolve([]))));

    await userEvent.click(toggle());

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith("Failed to update Knalleleden."));
    expect(toggle()).toBeChecked();
    release();
  });

  it("still says so when the change filters the trail out of view", async () => {
    renderPage("/trails?status=Active");
    await screen.findByText("1 of 2 trails");

    await userEvent.click(toggle());

    await waitFor(() => expect(toasts.toast.success).toHaveBeenCalledWith("Knalleleden is now hidden from the app."));
    expect(screen.queryByRole("checkbox", { name: "Active: Knalleleden" })).not.toBeInTheDocument();
  });

  it("keeps a second trail's change when the first one fails", async () => {
    let failFirst = () => {};
    api.mock.on(
      "PUT",
      VERIFIED,
      () => new Promise<void>((_, reject) => (failFirst = () => reject(new ApiError("Server error", 500)))),
    );
    let answerSecond = () => {};
    api.mock.on("PUT", `${TRAILS}/trail-2/verified`, () => new Promise<void>((resolve) => (answerSecond = resolve)));
    renderPage();
    await screen.findByText("2 of 2 trails");

    await userEvent.click(toggle());
    await userEvent.click(screen.getByRole("checkbox", { name: "Active: Ryaslingan" }));
    await waitFor(() => expect(api.mock.calls.filter((call) => call.method === "PUT")).toHaveLength(2));
    failFirst();

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith("Failed to update Knalleleden."));
    expect(toggle()).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Active: Ryaslingan" })).toBeChecked();
    answerSecond();
  });
});
