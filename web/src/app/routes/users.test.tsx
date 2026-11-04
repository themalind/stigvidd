// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthorStatisticResponse, ReporterStatisticResponse } from "@/api/generated/model";
import { authorStatistic, reporterStatistic } from "@/testing/fixtures/users";
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

import UsersPage from "./users";

const REPORTERS = "/api/v1/admin/content-reports/reporters";
const AUTHORS = "/api/v1/admin/content-reports/authors";
const BAN = "/api/v1/admin/users/author-1/ban";

let reporters: ReporterStatisticResponse[][] = [];
let authors: AuthorStatisticResponse[] = [];

function pageOf(url: string) {
  return Number(new URL(url, "http://x").searchParams.get("page"));
}

function lastPage() {
  return pageOf(api.mock.calls[api.mock.calls.length - 1].url);
}

function paged<T>(items: T[], hasMore = false) {
  return { items, page: 1, hasMore, totalCount: items.length };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  reporters = [[reporterStatistic()]];
  authors = [authorStatistic()];

  api.mock.on("GET", REPORTERS, () => {
    const page = lastPage();
    return paged(reporters[page - 1] ?? [], page < reporters.length);
  });
  api.mock.on("GET", AUTHORS, () => paged(authors));
  api.mock.on("POST", BAN, () => {
    authors = authors.map((author) => ({ ...author, bannedAt: "2026-03-04T10:00:00Z", banCount: author.banCount + 1 }));
    return undefined;
  });
  api.mock.on("DELETE", BAN, () => {
    authors = authors.map((author) => ({ ...author, bannedAt: null }));
    return undefined;
  });
});

const calls = (method: string, path: string) =>
  api.mock.calls.filter((call) => call.method === method && call.path === path);

async function openAuthors() {
  const user = userEvent.setup();
  renderWithProviders(<UsersPage />);
  await user.click(screen.getByRole("tab", { name: "Authors" }));
  await screen.findAllByTestId("author-row");
  return user;
}

describe("the reporters tab", () => {
  it("opens first and lists each reporter's record", async () => {
    renderWithProviders(<UsersPage />);

    const row = await screen.findByTestId("reporter-row");
    expect(row).toHaveTextContent("VandrarVennen");
    expect(row).toHaveTextContent("67%");
    expect(calls("GET", REPORTERS)[0].url).toContain("pageSize=25");
  });

  // Pending reports are not evidence either way, so a reporter with nothing decided must not
  // read as one who is always wrong.
  it("says nothing is decided rather than showing zero accuracy", async () => {
    reporters = [[reporterStatistic({ total: 3, pending: 3, dismissed: 0, upheld: 0 })]];
    renderWithProviders(<UsersPage />);

    expect(await screen.findByTestId("reporter-accuracy")).toHaveTextContent("Nothing decided");
  });

  // Rows climbing while nothing gets hidden looks like a broken hiding rule unless the tab
  // says why.
  it("marks a reporter whose reports no longer hide anything, and explains why", async () => {
    reporters = [[reporterStatistic({ reportsAreWithheld: true })]];
    renderWithProviders(<UsersPage />);

    const marker = await screen.findByTestId("reports-withheld");
    expect(marker).toHaveAttribute("title", expect.stringContaining("no longer hide"));
    expect(screen.getByTestId("withheld-summary")).toHaveTextContent("1 of these accounts");
  });

  it("leaves an ordinary reporter unmarked", async () => {
    renderWithProviders(<UsersPage />);

    await screen.findByTestId("reporter-row");
    expect(screen.queryByTestId("reports-withheld")).toBeNull();
    expect(screen.queryByTestId("withheld-summary")).toBeNull();
  });

  it("names a deleted account instead of leaving the cell blank", async () => {
    reporters = [[reporterStatistic({ nickName: null })]];
    renderWithProviders(<UsersPage />);

    expect(await screen.findByTestId("reporter-row")).toHaveTextContent("Account deleted");
  });

  it("pages forward and back, and asks for the next page only when there is one", async () => {
    const user = userEvent.setup();
    reporters = [[reporterStatistic()], [reporterStatistic({ nickName: "SidaTvå" })]];
    renderWithProviders(<UsersPage />);

    await screen.findByText("VandrarVennen");
    expect(screen.getByTestId("previous-page")).toBeDisabled();

    await user.click(screen.getByTestId("next-page"));

    expect(await screen.findByText("SidaTvå")).toBeInTheDocument();
    expect(pageOf(calls("GET", REPORTERS)[1].url)).toBe(2);
    expect(screen.getByTestId("next-page")).toBeDisabled();

    await user.click(screen.getByTestId("previous-page"));

    expect(await screen.findByText("VandrarVennen")).toBeInTheDocument();
    expect(calls("GET", REPORTERS)).toHaveLength(2);
  });

  it("shows a failed load with a way to try again, not an empty list", async () => {
    const user = userEvent.setup();
    let fail = true;
    api.mock.on("GET", REPORTERS, () => {
      if (fail) throw new Error("Nope");
      return paged([reporterStatistic()]);
    });
    renderWithProviders(<UsersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
    expect(screen.queryByTestId("empty-tab")).toBeNull();

    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByTestId("reporter-row")).toBeInTheDocument();
  });

  it("stays on the page that failed when the moderator tries again", async () => {
    const user = userEvent.setup();
    let fail = true;
    reporters = [[reporterStatistic()], [reporterStatistic({ nickName: "SidaTvå" })]];
    api.mock.on("GET", REPORTERS, () => {
      const page = lastPage();
      if (page === 2 && fail) throw new Error("Nope");
      return paged(reporters[page - 1], page < reporters.length);
    });
    renderWithProviders(<UsersPage />);

    await user.click(await screen.findByTestId("next-page"));
    await screen.findByRole("alert");

    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("SidaTvå")).toBeInTheDocument();
  });
});

describe("the authors tab", () => {
  it("shows strikes and how many times the author has been banned", async () => {
    authors = [authorStatistic({ banCount: 3 })];
    await openAuthors();

    expect(screen.getByTestId("author-row")).toHaveTextContent("SkogsGreven");
    expect(screen.getByTestId("author-strikes")).toHaveTextContent("2");
    expect(screen.getByTestId("author-bans")).toHaveTextContent("3");
  });

  // The number is what an account removal is decided on, so the list has to say what a
  // strike counts, or it reads as a report count.
  it("says a strike is one piece of content, not one report", async () => {
    authors = [authorStatistic({ strikes: 3 }), authorStatistic({ identifier: "author-2", strikes: 1 })];
    await openAuthors();

    expect(screen.getByText(/4 strikes on this page/)).toHaveTextContent("one piece of content");
  });

  // The two empty states mean opposite things about the backlog: nothing reported at all,
  // against reports that were all decided the author's way.
  it("explains each empty tab in its own terms", async () => {
    const user = userEvent.setup();
    reporters = [[]];
    authors = [];
    renderWithProviders(<UsersPage />);

    expect(await screen.findByTestId("empty-tab")).toHaveTextContent("Nobody has reported anything yet.");

    await user.click(screen.getByRole("tab", { name: "Authors" }));

    expect(await screen.findByTestId("empty-tab")).toHaveTextContent("upheld");
  });

  it("offers no ban for an account that is already gone", async () => {
    authors = [authorStatistic({ identifier: null, nickName: null, strikes: 3 })];
    await openAuthors();

    expect(screen.getByTestId("ban-author")).toBeDisabled();
  });
});

describe("banning", () => {
  it("bans only after the moderator confirms, and says who it was", async () => {
    const user = await openAuthors();

    await user.click(screen.getByTestId("ban-author"));

    expect(await screen.findByTestId("ban-body")).toHaveTextContent("SkogsGreven");
    expect(calls("POST", BAN)).toHaveLength(0);

    await user.type(screen.getByTestId("ban-reason"), "abusive reviews");
    await user.click(screen.getByTestId("confirm-ban"));

    await waitFor(() =>
      expect(calls("POST", BAN)).toEqual([expect.objectContaining({ body: { reason: "abusive reviews" } })]),
    );
    expect(toasts.toast.success).toHaveBeenCalledWith("SkogsGreven can no longer write in the app.");
  });

  it("closes the sheet and shows the row as banned", async () => {
    const user = await openAuthors();

    await user.click(screen.getByTestId("ban-author"));
    await user.click(await screen.findByTestId("confirm-ban"));

    const row = within(screen.getByTestId("author-row"));
    expect(await row.findByTestId("banned-since")).toHaveTextContent("Banned");
    expect(screen.getByTestId("author-bans")).toHaveTextContent("1");
    expect(screen.queryByTestId("ban-body")).toBeNull();
  });

  it("starts every ban with an empty reason, even after a cancelled one", async () => {
    const user = await openAuthors();

    await user.click(screen.getByTestId("ban-author"));
    await user.type(await screen.findByTestId("ban-reason"), "meant for someone else");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByTestId("ban-author"));

    expect(await screen.findByTestId("ban-reason")).toHaveValue("");
  });

  it("leaves the sheet open and reports why when the ban fails", async () => {
    api.mock.on("POST", BAN, () => {
      throw new Error("the server said no");
    });
    const user = await openAuthors();

    await user.click(screen.getByTestId("ban-author"));
    await user.click(await screen.findByTestId("confirm-ban"));

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith("the server said no"));
    expect(screen.getByTestId("ban-body")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-ban")).toBeEnabled();
  });
});

describe("lifting a ban", () => {
  beforeEach(() => {
    authors = [authorStatistic({ bannedAt: "2026-03-04T10:00:00Z", banCount: 1 })];
  });

  it("says when an account is already banned, and offers to lift it instead", async () => {
    await openAuthors();

    expect(screen.getByTestId("banned-since")).toHaveTextContent("Banned");
    expect(screen.getByTestId("unban-author")).toBeInTheDocument();
    expect(screen.queryByTestId("ban-author")).toBeNull();
  });

  // Letting someone back in is the reversible direction, so it takes no confirmation sheet.
  it("lifts the ban on the account whose row was pressed, and offers a ban again", async () => {
    const user = await openAuthors();

    await user.click(screen.getByTestId("unban-author"));

    expect(await screen.findByTestId("ban-author")).toBeEnabled();
    expect(calls("DELETE", BAN)).toHaveLength(1);
    expect(toasts.toast.success).toHaveBeenCalledWith("SkogsGreven can write again.");
  });

  it("reports why when the ban cannot be lifted", async () => {
    api.mock.on("DELETE", BAN, () => {
      throw new Error("the server said no");
    });
    const user = await openAuthors();

    await user.click(screen.getByTestId("unban-author"));

    await waitFor(() => expect(toasts.toast.error).toHaveBeenCalledWith("the server said no"));
    expect(screen.getByTestId("unban-author")).toBeEnabled();
  });
});
