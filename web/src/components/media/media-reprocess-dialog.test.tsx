// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReprocessJobSummary } from "@/api/media";
import type { ReprocessTarget } from "@/lib/media-reprocess-target";

const mediaApi = vi.hoisted(() => ({
  enqueueMediaReprocessJob: vi.fn(),
  enqueueMediaReprocessJobForFilter: vi.fn(),
}));
vi.mock("@/api/media", () => mediaApi);

const toasted = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasted }));

import MediaReprocessDialog from "./media-reprocess-dialog";

async function pick(label: RegExp | string, option: RegExp | string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

const onOpenChange = vi.fn();
const onSubmitted = vi.fn();

function show(target: ReprocessTarget = { kind: "ids", mediaIdentifiers: ["media-1", "media-2"] }) {
  return render(
    <MediaReprocessDialog
      open
      onOpenChange={onOpenChange}
      target={target}
      onSubmitted={onSubmitted}
    />,
  );
}

const startButton = () => screen.getByRole("button", { name: /start batch/i });

describe("MediaReprocessDialog", () => {
  it("submits the default optimized preset's options for every selected identifier", async () => {
    mediaApi.enqueueMediaReprocessJob.mockResolvedValue({ identifier: "job-1" });
    show();

    await userEvent.click(startButton());

    await waitFor(() =>
      expect(mediaApi.enqueueMediaReprocessJob).toHaveBeenCalledWith(
        ["media-1", "media-2"],
        { maxWidth: 800, maxHeight: 800, quality: 50, format: "webp" },
      ),
    );
  });

  it("switches to the thumbnail preset's options when chosen", async () => {
    mediaApi.enqueueMediaReprocessJob.mockResolvedValue({ identifier: "job-1" });
    show();

    await pick("Preset", /Thumbnail/);
    await userEvent.click(startButton());

    await waitFor(() =>
      expect(mediaApi.enqueueMediaReprocessJob).toHaveBeenCalledWith(
        ["media-1", "media-2"],
        { maxWidth: 400, maxHeight: 400, quality: 75, format: "webp" },
      ),
    );
  });

  it("sends custom width/height when Custom resolution is picked", async () => {
    mediaApi.enqueueMediaReprocessJob.mockResolvedValue({ identifier: "job-1" });
    show();

    await pick("Max resolution", "Custom…");
    await userEvent.type(screen.getByLabelText("Max width"), "1234");
    await userEvent.type(screen.getByLabelText("Max height"), "999");
    await userEvent.click(startButton());

    await waitFor(() =>
      expect(mediaApi.enqueueMediaReprocessJob).toHaveBeenCalledWith(
        ["media-1", "media-2"],
        expect.objectContaining({ maxWidth: 1234, maxHeight: 999 }),
      ),
    );
  });

  it("reports the new job and closes on success", async () => {
    const job: ReprocessJobSummary = { identifier: "job-1" } as ReprocessJobSummary;
    mediaApi.enqueueMediaReprocessJob.mockResolvedValue(job);
    show();

    await userEvent.click(startButton());

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(job));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open and shows the server's own message when the request fails", async () => {
    mediaApi.enqueueMediaReprocessJob.mockRejectedValue(new Error("boom"));
    show();

    await userEvent.click(startButton());

    await waitFor(() => expect(toasted.error).toHaveBeenCalledWith("boom"));
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("keeps the web preset reachable now that optimized is the default", async () => {
    mediaApi.enqueueMediaReprocessJob.mockResolvedValue({ identifier: "job-1" });
    show();

    await pick("Preset", /^Web —/);
    await userEvent.click(startButton());

    await waitFor(() =>
      expect(mediaApi.enqueueMediaReprocessJob).toHaveBeenCalledWith(
        ["media-1", "media-2"],
        { maxWidth: 1600, maxHeight: 1600, quality: 80, format: "webp" },
      ),
    );
  });

  it("sends the filter, not identifiers, in filter mode", async () => {
    mediaApi.enqueueMediaReprocessJobForFilter.mockResolvedValue({ identifier: "job-1" });
    const filter = { targetMaxWidth: 800, targetFormat: "webp" };
    show({ kind: "filter", filter, matchingCount: 1204, summary: "needs work" });

    await userEvent.click(startButton());

    await waitFor(() =>
      expect(mediaApi.enqueueMediaReprocessJobForFilter).toHaveBeenCalledWith(
        filter,
        { maxWidth: 800, maxHeight: 800, quality: 50, format: "webp" },
      ),
    );
    expect(mediaApi.enqueueMediaReprocessJob).not.toHaveBeenCalled();
  });

  it("states the matching count in filter mode", async () => {
    show({
      kind: "filter",
      filter: { targetMaxWidth: 800 },
      matchingCount: 1204,
      summary: "needs work",
    });

    expect(screen.getByText(/Optimize all 1204 matching images/i)).toBeInTheDocument();
    expect(startButton()).toHaveTextContent("1204");
  });

  it("stops naming a preset once its values have been edited", async () => {
    show();

    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveTextContent(/Optimized/);

    await pick("Max resolution", "1280px");

    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveTextContent(/Custom/);
  });
});
