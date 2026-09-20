// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MediaItemResponse } from "@/types/types";
import type { ReprocessJobSummary } from "@/api/media";

const mediaApi = vi.hoisted(() => ({
  getAllMedia: vi.fn(),
  updateImageMetadata: vi.fn(),
}));
vi.mock("@/api/media", () => mediaApi);

const trailApi = vi.hoisted(() => ({ deleteTrailImage: vi.fn() }));
vi.mock("@/api/trail", () => trailApi);

const facilityApi = vi.hoisted(() => ({ deleteFacilityImage: vi.fn() }));
vi.mock("@/api/facility", () => facilityApi);

const toasted = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasted }));

const dialogProps = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("./media-reprocess-dialog", () => ({
  default: (props: {
    open: boolean;
    mediaIdentifiers: string[];
    onSubmitted: (job: ReprocessJobSummary) => void;
  }) => {
    dialogProps.current = props;
    if (!props.open) return null;
    return (
      <div>
        <span data-testid="reprocess-selection">
          {props.mediaIdentifiers.join(",")}
        </span>
        <button
          onClick={() => props.onSubmitted({ identifier: "job-1" } as ReprocessJobSummary)}
        >
          fake-submit
        </button>
      </div>
    );
  },
}));

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
    width: 800,
    height: 600,
    sizeBytes: 2048,
  }) as MediaItemResponse;

const onBatchStarted = vi.fn();
const show = () => render(<MediaBrowse refreshKey={0} onBatchStarted={onBatchStarted} />);

beforeEach(() => {
  mediaApi.getAllMedia.mockResolvedValue([
    item("trail-1", "Trail"),
    item("facility-1", "Facility"),
    item("symbol-1", "TrailSymbol"),
  ]);
});

async function loaded() {
  await waitFor(() => expect(screen.getByText("Owner trail-1")).toBeInTheDocument());
}

describe("selecting images for a batch", () => {
  it("offers no batch action until something is selected", async () => {
    show();
    await loaded();

    expect(screen.getByRole("button", { name: /optimize selected/i })).toBeDisabled();
  });

  it("enables the batch action and shows the count once an image is checked", async () => {
    show();
    await loaded();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);

    await userEvent.click(screen.getAllByRole("checkbox")[1]);

    expect(screen.getByRole("button", { name: /optimize selected \(1\)/i })).toBeEnabled();
  });

  it("select-all only ever selects Trail/Facility images, never a symbol", async () => {
    show();
    await loaded();

    await userEvent.click(screen.getByRole("checkbox", { name: /select all/i }));

    await userEvent.click(screen.getByRole("button", { name: /optimize selected/i }));

    expect(screen.getByTestId("reprocess-selection")).toHaveTextContent(
      "trail-1,facility-1",
    );
  });

  it("clears the selection once the dialog reports a submitted batch", async () => {
    show();
    await loaded();

    await userEvent.click(screen.getAllByRole("checkbox")[1]);
    await userEvent.click(screen.getByRole("button", { name: /optimize selected/i }));
    await userEvent.click(screen.getByText("fake-submit"));

    expect(onBatchStarted).toHaveBeenCalledWith({ identifier: "job-1" });
    expect(screen.getByRole("button", { name: /optimize selected/i })).toBeDisabled();
  });
});
