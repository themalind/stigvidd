// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MediaItemResponse, MediaLibraryPageResponse } from "@/api/generated/model";
import { libraryPage, mediaItem, reprocessJob } from "@/testing/fixtures/media";
import { renderWithProviders } from "@/testing/render";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const toasts = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

import MediaBrowse from "./media-browse";

const MEDIA = "/api/v1/admin/media";
const JOBS = "/api/v1/admin/media/reprocess";

const item = (identifier: string, ownerType: string): MediaItemResponse =>
  mediaItem({ identifier, ownerType, ownerIdentifier: `owner-${identifier}`, ownerName: `Owner ${identifier}` });

const threeKinds = () =>
  libraryPage([item("trail-1", "Trail"), item("facility-1", "Facility"), item("symbol-1", "TrailSymbol")]);
const longLibrary = (identifier = "trail-1") =>
  libraryPage([item(identifier, "Trail")], { totalCount: 90, reprocessableCount: 90, hasMore: true });

let respond: (query: URLSearchParams) => MediaLibraryPageResponse | Promise<MediaLibraryPageResponse>;

const listCalls = () => api.mock.calls.filter((call) => call.method === "GET" && call.path === MEDIA);
const lastQuery = () => new URLSearchParams(listCalls().at(-1)?.url.split("?")[1]);
const posted = () => api.mock.calls.find((call) => call.method === "POST" && call.path === JOBS)?.body;

const onBatchStarted = vi.fn();
const onTrailImagesChanged = vi.fn();
const show = () =>
  renderWithProviders(<MediaBrowse onTrailImagesChanged={onTrailImagesChanged} onBatchStarted={onBatchStarted} />);

const loaded = (owner = "trail-1") => screen.findByText(`Owner ${owner}`);
const optimize = () => screen.getByRole("button", { name: /^optimize/i });
const named = (owner: string) => `Owner ${owner} (${owner}.webp)`;
const select = (owner: string) => userEvent.click(screen.getByRole("checkbox", { name: `Select ${named(owner)}` }));
const needsWork = () => userEvent.click(screen.getByRole("button", { name: /needs work/i }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  api.mock.reset();
  respond = threeKinds;
  api.mock.on("GET", MEDIA, () => respond(lastQuery()));
  api.mock.on("POST", JOBS, () => reprocessJob({ identifier: "job-1", totalCount: 2 }));
});

describe("selecting images for a batch", () => {
  it("offers no batch action until something is selected", async () => {
    show();
    await loaded();

    expect(optimize()).toBeDisabled();
  });

  it("enables the batch action and shows the count once an image is checked", async () => {
    show();
    await loaded();

    await select("trail-1");

    expect(optimize()).toBeEnabled();
    expect(optimize()).toHaveTextContent("Optimize 1");
  });

  it("never offers a trail symbol a checkbox", async () => {
    show();
    await loaded();

    expect(screen.queryByRole("checkbox", { name: `Select ${named("symbol-1")}` })).toBeNull();
  });

  it("the page checkbox only ever selects Trail/Facility images", async () => {
    show();
    await loaded();

    await userEvent.click(screen.getByRole("checkbox", { name: "Select every image on this page" }));
    await userEvent.click(optimize());
    await userEvent.click(screen.getByRole("button", { name: /start batch/i }));

    await waitFor(() => expect(posted()).toMatchObject({ mediaIdentifiers: ["trail-1", "facility-1"] }));
  });

  it("clears the selection and hands over the job once a batch has started", async () => {
    show();
    await loaded();

    await select("trail-1");
    await userEvent.click(optimize());
    await userEvent.click(screen.getByRole("button", { name: /start batch/i }));

    await waitFor(() => expect(onBatchStarted).toHaveBeenCalledWith(expect.objectContaining({ identifier: "job-1" })));
    expect(optimize()).toBeDisabled();
  });
});

describe("filtering", () => {
  it("keeps the filter bar reachable when a filter matches nothing", async () => {
    show();
    await loaded();

    respond = () => libraryPage([]);
    await needsWork();

    expect(await screen.findByText(/No images match/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /needs work/i })).toBeInTheDocument();
  });

  it("asks the server for the preset bounds when Needs work is on", async () => {
    show();
    await loaded();

    await needsWork();

    await waitFor(() => expect(lastQuery().get("TargetMaxWidth")).toBe("800"));
    expect(lastQuery().get("TargetFormat")).toBe("webp");
  });

  it("narrows by owner, and says what it is showing", async () => {
    show();
    await loaded();

    await userEvent.click(
      within(screen.getByRole("group", { name: "Owner" })).getByRole("button", { name: "Symbols" }),
    );

    await waitFor(() => expect(lastQuery().get("OwnerType")).toBe("TrailSymbol"));
    expect(screen.getByText(/^Showing:/)).toBeInTheDocument();
  });

  it("returns to page 1 when the filter changes", async () => {
    respond = () => longLibrary();
    show();
    await loaded();

    await userEvent.click(screen.getByTestId("next-page"));
    await waitFor(() => expect(lastQuery().get("Page")).toBe("2"));

    await needsWork();

    await waitFor(() => expect(lastQuery().get("Page")).toBe("1"));
  });

  it("makes exactly one request when the filter changes from a later page", async () => {
    respond = () => longLibrary();
    show();
    await loaded();
    await userEvent.click(screen.getByTestId("next-page"));
    await waitFor(() => expect(lastQuery().get("Page")).toBe("2"));
    const before = listCalls().length;

    await needsWork();
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));

    expect(listCalls()).toHaveLength(before + 1);
    expect(lastQuery().get("Page")).toBe("1");
  });

  it("shows the page the pager reports when a slow response for the old page lands late", async () => {
    respond = () => longLibrary();
    show();
    await loaded();

    let releaseStale: () => void = () => {};
    respond = () =>
      new Promise((resolve) => {
        releaseStale = () => resolve(longLibrary("stale-1"));
      });
    await userEvent.click(screen.getByTestId("next-page"));
    respond = () => libraryPage([item("fresh-1", "Trail")]);

    await needsWork();
    await loaded("fresh-1");
    releaseStale();

    await waitFor(() => expect(screen.getByText("Owner fresh-1")).toBeInTheDocument());
    expect(screen.queryByText("Owner stale-1")).not.toBeInTheDocument();
  });

  it("drops a selection made under the previous filter", async () => {
    show();
    await loaded();

    await select("trail-1");
    expect(optimize()).toBeEnabled();

    await needsWork();

    await waitFor(() => expect(optimize()).toBeDisabled());
  });

  it("applies the extra filters only when asked to", async () => {
    show();
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: "More filters" }));
    await userEvent.type(screen.getByLabelText("Minimum width"), "1000");
    expect(lastQuery().get("MinWidth")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => expect(lastQuery().get("MinWidth")).toBe("1000"));
  });
});

describe("sorting", () => {
  it("asks the server for newest first before anything is chosen", async () => {
    show();
    await loaded();

    expect(lastQuery().get("Sort")).toBe("newest");
  });

  it("sends the chosen sort", async () => {
    show();
    await loaded();

    await userEvent.selectOptions(screen.getByLabelText("Sort"), "largest");

    await waitFor(() => expect(lastQuery().get("Sort")).toBe("largest"));
    expect(lastQuery().get("Page")).toBe("1");
  });

  it("rewinds to page 1 but keeps the selection, because the same images are still matched", async () => {
    respond = () => longLibrary();
    show();
    await loaded();

    await select("trail-1");
    await userEvent.click(screen.getByTestId("next-page"));
    await waitFor(() => expect(lastQuery().get("Page")).toBe("2"));

    await userEvent.selectOptions(screen.getByLabelText("Sort"), "oldest");

    await waitFor(() => expect(lastQuery().get("Sort")).toBe("oldest"));
    expect(lastQuery().get("Page")).toBe("1");
    expect(optimize()).toBeEnabled();
  });
});

describe("deleting an image", () => {
  it("re-reads the library so the totals and the size do not drift", async () => {
    vi.stubGlobal("confirm", () => true);
    let library = libraryPage([item("trail-1", "Trail"), item("trail-2", "Trail")]);
    respond = () => library;
    api.mock.on("DELETE", "/api/v1/admin/trails/images/trail-1", () => {
      library = libraryPage([item("trail-2", "Trail")]);
      return undefined;
    });
    show();
    await loaded();
    expect(screen.getByText(/of 2/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: `Delete ${named("trail-1")}` }));

    expect(await screen.findByText(/of 1/)).toBeInTheDocument();
    expect(onTrailImagesChanged).toHaveBeenCalled();
    expect(toasts.success).toHaveBeenCalledWith("Image deleted.");
  });

  it("sends a facility's image to the facility endpoint, which leaves the trails alone", async () => {
    vi.stubGlobal("confirm", () => true);
    api.mock.on("DELETE", "/api/v1/admin/facilities/images/facility-1", () => undefined);
    show();
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: `Delete ${named("facility-1")}` }));

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Image deleted."));
    expect(onTrailImagesChanged).not.toHaveBeenCalled();
  });

  it("does nothing when the question is answered no", async () => {
    vi.stubGlobal("confirm", () => false);
    show();
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: `Delete ${named("trail-1")}` }));

    expect(api.mock.calls.some((call) => call.method === "DELETE")).toBe(false);
  });
});

describe("editing metadata", () => {
  it("saves the alt text and caption, then shows the library as the server has it", async () => {
    api.mock.on("PATCH", `${MEDIA}/trail-1`, () => {
      respond = () => libraryPage([mediaItem({ ...item("trail-1", "Trail"), altText: "A bridge" })]);
      return undefined;
    });
    show();
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: `Edit metadata for ${named("trail-1")}` }));
    await userEvent.clear(screen.getByLabelText("Alt text"));
    await userEvent.type(screen.getByLabelText("Alt text"), "A bridge");
    await userEvent.type(screen.getByLabelText("Caption"), "Over the river");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Metadata saved."));
    expect(api.mock.calls.find((call) => call.method === "PATCH")?.body).toEqual({
      altText: "A bridge",
      caption: "Over the river",
    });
    expect(screen.queryByRole("dialog", { name: "Edit metadata" })).toBeNull();
    expect(await screen.findByAltText("A bridge")).toBeInTheDocument();
  });

  it("stays open when the save fails", async () => {
    api.mock.on("PATCH", `${MEDIA}/trail-1`, () => {
      throw new Error("Alt text is too long.");
    });
    show();
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: `Edit metadata for ${named("trail-1")}` }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("Alt text is too long."));
    expect(screen.getByRole("dialog", { name: "Edit metadata" })).toBeInTheDocument();
  });
});

describe("the batch dialog", () => {
  it("opens on the default preset again, not on the last batch's settings", async () => {
    show();
    await loaded();
    await select("trail-1");
    await userEvent.click(optimize());
    await userEvent.click(screen.getByRole("combobox", { name: "Preset" }));
    await userEvent.click(await screen.findByRole("option", { name: /Thumbnail/ }));
    await userEvent.click(screen.getByRole("button", { name: /start batch/i }));
    await waitFor(() => expect(onBatchStarted).toHaveBeenCalled());

    await select("trail-1");
    await userEvent.click(optimize());

    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveTextContent(/Optimized/);
  });
});

describe("select all matching", () => {
  it("hands the dialog a filter rather than identifiers", async () => {
    respond = () =>
      libraryPage([item("trail-1", "Trail")], { totalCount: 1204, reprocessableCount: 1204, hasMore: true });
    show();
    await loaded();

    await userEvent.click(screen.getByRole("checkbox", { name: "Select every image on this page" }));
    await userEvent.click(screen.getByRole("button", { name: /select all 1204 matching/i }));
    await userEvent.click(optimize());
    await userEvent.click(screen.getByRole("button", { name: /start batch/i }));

    await waitFor(() => expect(posted()).toHaveProperty("filter"));
    expect(posted()).not.toHaveProperty("mediaIdentifiers");
  });

  it("is not offered while the page still has unselected images", async () => {
    show();
    await loaded();

    await select("trail-1");

    expect(screen.queryByRole("button", { name: /matching this filter/i })).toBeNull();
  });
});

describe("loading and keyboard access", () => {
  it("shows a failed load as the server's message with a retry, not as an empty library", async () => {
    let call = 0;
    respond = () => {
      if (++call === 1) throw new Error("The library is unavailable.");
      return threeKinds();
    };
    show();

    expect(await screen.findByText("The library is unavailable.")).toBeInTheDocument();
    expect(screen.queryByText(/no media yet/i)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await loaded();
    expect(screen.queryByText("The library is unavailable.")).toBeNull();
  });

  it("opens the enlarged view from the keyboard", async () => {
    show();
    await loaded();

    screen.getByRole("button", { name: `Enlarge ${named("trail-1")}` }).focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("dialog", { name: "Enlarged image" })).toBeInTheDocument();
  });
});
