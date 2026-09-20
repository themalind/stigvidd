// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReprocessJobSummary } from "@/api/media";

const mediaApi = vi.hoisted(() => ({
  getMediaReprocessJobs: vi.fn(),
  cancelMediaReprocessJob: vi.fn(),
}));
vi.mock("@/api/media", () => mediaApi);

const toasted = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasted }));

import MediaReprocessJobs from "./media-reprocess-jobs";

const job = (overrides: Partial<ReprocessJobSummary>): ReprocessJobSummary =>
  ({
    identifier: "job-1",
    status: "Pending",
    totalCount: 2,
    pendingCount: 2,
    processingCount: 0,
    succeededCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    lastUpdatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as ReprocessJobSummary;

beforeEach(() => {
  vi.useRealTimers();
});

describe("MediaReprocessJobs", () => {
  it("shows a message when there are no batches yet", async () => {
    mediaApi.getMediaReprocessJobs.mockResolvedValue({ items: [] });

    render(<MediaReprocessJobs refreshKey={0} />);

    await waitFor(() => expect(screen.getByText(/no batches yet/i)).toBeInTheDocument());
  });

  it("lists a job's progress", async () => {
    mediaApi.getMediaReprocessJobs.mockResolvedValue({
      items: [job({ succeededCount: 1, pendingCount: 1, totalCount: 2 })],
    });

    render(<MediaReprocessJobs refreshKey={0} />);

    await waitFor(() => expect(screen.getByText("1/2 succeeded")).toBeInTheDocument());
  });

  it("offers Cancel only while a job still has pending items", async () => {
    mediaApi.getMediaReprocessJobs.mockResolvedValue({
      items: [
        job({ identifier: "job-pending", pendingCount: 1 }),
        job({ identifier: "job-done", pendingCount: 0, succeededCount: 2, status: "Completed" }),
      ],
    });

    render(<MediaReprocessJobs refreshKey={0} />);

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /cancel/i })).toHaveLength(1),
    );
  });

  it("cancels the job and reloads the list", async () => {
    mediaApi.getMediaReprocessJobs.mockResolvedValue({ items: [job({})] });
    mediaApi.cancelMediaReprocessJob.mockResolvedValue(
      job({ pendingCount: 0, cancelledCount: 2, status: "Completed" }),
    );

    render(<MediaReprocessJobs refreshKey={0} />);
    await waitFor(() => screen.getByRole("button", { name: /cancel/i }));

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => expect(mediaApi.cancelMediaReprocessJob).toHaveBeenCalledWith("job-1"));
    expect(mediaApi.getMediaReprocessJobs).toHaveBeenCalledTimes(2);
  });

  function calledWithPollDelay(calls: unknown[][]): boolean {
    return calls.some((call) => call[1] === 3000);
  }

  it("registers a poll interval while a job is still pending", async () => {
    mediaApi.getMediaReprocessJobs.mockResolvedValue({ items: [job({})] });
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    render(<MediaReprocessJobs refreshKey={0} />);
    await waitFor(() => expect(mediaApi.getMediaReprocessJobs).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(calledWithPollDelay(setIntervalSpy.mock.calls)).toBe(true));

    setIntervalSpy.mockRestore();
  });

  it("registers no poll interval once every job has settled", async () => {
    mediaApi.getMediaReprocessJobs.mockResolvedValue({
      items: [job({ pendingCount: 0, succeededCount: 2, status: "Completed" })],
    });
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    render(<MediaReprocessJobs refreshKey={0} />);
    await waitFor(() => expect(mediaApi.getMediaReprocessJobs).toHaveBeenCalledTimes(1));

    expect(calledWithPollDelay(setIntervalSpy.mock.calls)).toBe(false);
    setIntervalSpy.mockRestore();
  });
});
