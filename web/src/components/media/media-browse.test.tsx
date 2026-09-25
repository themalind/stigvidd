// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MediaItemResponse } from "@/api/generated/model";
import type { ReprocessJobSummary } from "@/api/media";
import type { ReprocessTarget } from "@/lib/media-reprocess-target";

const mediaApi = vi.hoisted(() => ({
  getMedia: vi.fn(),
  updateImageMetadata: vi.fn(),
}));
vi.mock("@/api/media", () => mediaApi);

const trailApi = vi.hoisted(() => ({ deleteTrailImage: vi.fn() }));
vi.mock("@/api/trail", () => trailApi);

const facilityApi = vi.hoisted(() => ({ deleteFacilityImage: vi.fn() }));
vi.mock("@/api/facility", () => facilityApi);

const toasted = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasted }));

const dialogProps = vi.hoisted(() => ({ mounts: 0 }));
const noteMount = vi.hoisted(() => () => {
  dialogProps.mounts += 1;
});
vi.mock("./media-reprocess-dialog", () => {
  function DialogStub(props: {
    open: boolean;
    target: ReprocessTarget;
    onSubmitted: (job: ReprocessJobSummary) => void;
  }) {
    // A fresh mount is what resets the preset, so the test needs to see mounts, not renders.
    useEffect(noteMount, []);
    if (!props.open) return null;
    return (
      <div>
        <span data-testid="reprocess-target">
          {props.target.kind === "ids"
            ? props.target.mediaIdentifiers.join(",")
            : `filter:${props.target.matchingCount}`}
        </span>
        <button
          onClick={() => props.onSubmitted({ identifier: "job-1" } as ReprocessJobSummary)}
        >
          fake-submit
        </button>
      </div>
    );
  }

  return { default: DialogStub };
});

import MediaBrowse from "./media-browse";

const item = (identifier: string, ownerType: string): MediaItemResponse =>
  ({
    identifier,
    ownerType,
    ownerIdentifier: `owner-${identifier}`,
    ownerName: `Owner ${identifier}`,
    imageUrl: `https://media.test/${identifier}.webp`,
    altText: null,
    caption: null,
    format: "webp",
    width: 800,
    height: 600,
    sizeBytes: 2048,
    createdAt: "2026-03-12T09:00:00Z",
  }) as MediaItemResponse;

const page = (
  items: MediaItemResponse[],
  extra: { totalCount?: number; reprocessableCount?: number; hasMore?: boolean } = {},
) => ({
  items,
  page: 1,
  hasMore: extra.hasMore ?? false,
  totalCount: extra.totalCount ?? items.length,
  reprocessableCount: extra.reprocessableCount ?? items.length,
  totalSizeBytes: 4096,
});

const onBatchStarted = vi.fn();
const show = () => render(<MediaBrowse refreshKey={0} onBatchStarted={onBatchStarted} />);

beforeEach(() => {
  dialogProps.mounts = 0;
  mediaApi.getMedia.mockResolvedValue(
    page(
      [item("trail-1", "Trail"), item("facility-1", "Facility"), item("symbol-1", "TrailSymbol")],
      { totalCount: 3, reprocessableCount: 2 },
    ),
  );
});

async function loaded() {
  await waitFor(() => expect(screen.getByText("Owner trail-1")).toBeInTheDocument());
}

const optimize = () => screen.getByRole("button", { name: /^optimize/i });

describe("selecting images for a batch", () => {
  it("offers no batch action until something is selected", async () => {
    show();
    await loaded();

    expect(optimize()).toBeDisabled();
  });

  it("enables the batch action and shows the count once an image is checked", async () => {
    show();
    await loaded();

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Owner trail-1" }));

    expect(optimize()).toBeEnabled();
    expect(optimize()).toHaveTextContent("1");
  });

  it("never offers a trail symbol a checkbox", async () => {
    show();
    await loaded();

    expect(screen.queryByRole("checkbox", { name: "Select Owner symbol-1" })).toBeNull();
  });

  it("the page checkbox only ever selects Trail/Facility images", async () => {
    show();
    await loaded();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select every image on this page" }),
    );
    await userEvent.click(optimize());

    expect(screen.getByTestId("reprocess-target")).toHaveTextContent("trail-1,facility-1");
  });

  it("clears the selection once the dialog reports a submitted batch", async () => {
    show();
    await loaded();

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Owner trail-1" }));
    await userEvent.click(optimize());
    await userEvent.click(screen.getByText("fake-submit"));

    expect(onBatchStarted).toHaveBeenCalledWith({ identifier: "job-1" });
    expect(optimize()).toBeDisabled();
  });
});

describe("filtering", () => {
  it("keeps the filter bar reachable when a filter matches nothing", async () => {
    show();
    await loaded();

    mediaApi.getMedia.mockResolvedValue(page([], { totalCount: 0, reprocessableCount: 0 }));
    await userEvent.click(screen.getByRole("button", { name: /needs work/i }));

    await waitFor(() => expect(screen.getByText(/No images match/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /needs work/i })).toBeInTheDocument();
  });

  it("asks the server for the preset bounds when Needs work is on", async () => {
    show();
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: /needs work/i }));

    await waitFor(() =>
      expect(mediaApi.getMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({ TargetMaxWidth: 800, TargetFormat: "webp" }),
      ),
    );
  });

  it("returns to page 1 when the filter changes", async () => {
    mediaApi.getMedia.mockResolvedValue(
      page([item("trail-1", "Trail")], { totalCount: 90, reprocessableCount: 90, hasMore: true }),
    );
    show();
    await loaded();

    await userEvent.click(screen.getByTestId("next-page"));
    await waitFor(() =>
      expect(mediaApi.getMedia).toHaveBeenLastCalledWith(expect.objectContaining({ Page: 2 })),
    );

    await userEvent.click(screen.getByRole("button", { name: /needs work/i }));

    await waitFor(() =>
      expect(mediaApi.getMedia).toHaveBeenLastCalledWith(expect.objectContaining({ Page: 1 })),
    );
  });

  it("makes exactly one request when the filter changes from a later page", async () => {
    mediaApi.getMedia.mockResolvedValue(
      page([item("trail-1", "Trail")], { totalCount: 90, reprocessableCount: 90, hasMore: true }),
    );
    show();
    await loaded();

    await userEvent.click(screen.getByTestId("next-page"));
    await waitFor(() =>
      expect(mediaApi.getMedia).toHaveBeenLastCalledWith(expect.objectContaining({ Page: 2 })),
    );
    mediaApi.getMedia.mockClear();

    await userEvent.click(screen.getByRole("button", { name: /needs work/i }));
    await waitFor(() => expect(mediaApi.getMedia).toHaveBeenCalled());

    // A second call here is the narrowed filter fetched once for the stale page and once for
    // page 1, and nothing decides which of the two lands last.
    expect(mediaApi.getMedia).toHaveBeenCalledTimes(1);
    expect(mediaApi.getMedia).toHaveBeenCalledWith(expect.objectContaining({ Page: 1 }));
  });

  it("shows the page the pager reports when a slow response for the old page lands late", async () => {
    const slowPageTwo = page([item("stale-1", "Trail")], {
      totalCount: 90,
      reprocessableCount: 90,
      hasMore: true,
    });
    const freshPageOne = page([item("fresh-1", "Trail")], {
      totalCount: 1,
      reprocessableCount: 1,
    });

    mediaApi.getMedia.mockResolvedValue(
      page([item("trail-1", "Trail")], { totalCount: 90, reprocessableCount: 90, hasMore: true }),
    );
    show();
    await loaded();

    let releaseStale: (value: unknown) => void = () => {};
    mediaApi.getMedia.mockImplementationOnce(
      () => new Promise((resolve) => (releaseStale = resolve)),
    );

    await userEvent.click(screen.getByTestId("next-page"));
    mediaApi.getMedia.mockResolvedValue(freshPageOne);

    await userEvent.click(screen.getByRole("button", { name: /needs work/i }));
    await waitFor(() => expect(screen.getByText("Owner fresh-1")).toBeInTheDocument());

    releaseStale(slowPageTwo);
    await waitFor(() => expect(screen.getByText("Owner fresh-1")).toBeInTheDocument());
    expect(screen.queryByText("Owner stale-1")).not.toBeInTheDocument();
  });

  it("drops a selection made under the previous filter", async () => {
    show();
    await loaded();

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Owner trail-1" }));
    expect(optimize()).toBeEnabled();

    await userEvent.click(screen.getByRole("button", { name: /needs work/i }));

    await waitFor(() => expect(optimize()).toBeDisabled());
  });

  it("shows the server's own message when the load fails", async () => {
    mediaApi.getMedia.mockRejectedValue(new Error("nope"));
    show();

    await waitFor(() => expect(toasted.error).toHaveBeenCalledWith("nope"));
  });
});

describe("sorting", () => {
  it("asks the server for newest first before anything is chosen", async () => {
    show();
    await loaded();

    expect(mediaApi.getMedia).toHaveBeenCalledWith(expect.objectContaining({ Sort: "newest" }));
  });

  it("sends the chosen sort", async () => {
    show();
    await loaded();

    await userEvent.selectOptions(screen.getByLabelText("Sort"), "largest");

    await waitFor(() =>
      expect(mediaApi.getMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({ Sort: "largest", Page: 1 }),
      ),
    );
  });

  it("rewinds to page 1 but keeps the selection, because the same images are still matched", async () => {
    mediaApi.getMedia.mockResolvedValue(
      page([item("trail-1", "Trail")], { totalCount: 90, reprocessableCount: 90, hasMore: true }),
    );
    show();
    await loaded();

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Owner trail-1" }));
    await userEvent.click(screen.getByTestId("next-page"));
    await waitFor(() =>
      expect(mediaApi.getMedia).toHaveBeenLastCalledWith(expect.objectContaining({ Page: 2 })),
    );

    await userEvent.selectOptions(screen.getByLabelText("Sort"), "oldest");

    await waitFor(() =>
      expect(mediaApi.getMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({ Sort: "oldest", Page: 1 }),
      ),
    );
    expect(optimize()).toBeEnabled();
  });
});

describe("deleting an image", () => {
  it("re-reads the library so the totals and the size do not drift", async () => {
    trailApi.deleteTrailImage.mockResolvedValue(undefined);
    vi.stubGlobal("confirm", () => true);

    mediaApi.getMedia
      .mockResolvedValueOnce(
        page([item("trail-1", "Trail"), item("trail-2", "Trail")], {
          totalCount: 2,
          reprocessableCount: 2,
        }),
      )
      .mockResolvedValueOnce(page([item("trail-2", "Trail")], { totalCount: 1, reprocessableCount: 1 }));

    show();
    await loaded();
    expect(screen.getByText(/of 2/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete Owner trail-1" }));

    await waitFor(() => expect(trailApi.deleteTrailImage).toHaveBeenCalledWith("trail-1"));
    await waitFor(() => expect(screen.getByText(/of 1/)).toBeInTheDocument());
  });
});

describe("the batch dialog", () => {
  it("is mounted afresh each time it opens, so it cannot reopen on the last batch settings", async () => {
    show();
    await loaded();

    expect(dialogProps.mounts).toBe(0);

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Owner trail-1" }));
    await userEvent.click(optimize());
    await waitFor(() => expect(screen.getByTestId("reprocess-target")).toBeInTheDocument());
    expect(dialogProps.mounts).toBe(1);

    await userEvent.click(screen.getByRole("button", { name: "fake-submit" }));
    await waitFor(() =>
      expect(screen.queryByTestId("reprocess-target")).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Owner trail-1" }));
    await userEvent.click(optimize());
    await waitFor(() => expect(screen.getByTestId("reprocess-target")).toBeInTheDocument());

    // A second mount is the whole point: the preset the operator last used is gone with it.
    expect(dialogProps.mounts).toBe(2);
  });
});

describe("select all matching", () => {
  it("hands the dialog a filter rather than identifiers", async () => {
    mediaApi.getMedia.mockResolvedValue(
      page([item("trail-1", "Trail")], { totalCount: 1204, reprocessableCount: 1204, hasMore: true }),
    );
    show();
    await loaded();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Select every image on this page" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /select all 1204 matching/i }));
    await userEvent.click(optimize());

    expect(screen.getByTestId("reprocess-target")).toHaveTextContent("filter:1204");
  });

  it("is not offered while the page still has unselected images", async () => {
    show();
    await loaded();

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Owner trail-1" }));

    expect(screen.queryByRole("button", { name: /matching this filter/i })).toBeNull();
  });
});
