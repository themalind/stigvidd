// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReprocessJobSummary } from "@/api/media";

const mediaApi = vi.hoisted(() => ({
  getMediaReprocessJobs: vi.fn(),
  getMediaReprocessJob: vi.fn(),
  cancelMediaReprocessJob: vi.fn(),
  retryMediaReprocessJob: vi.fn(),
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
  vi.clearAllMocks();
});

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const failedItem = (mediaIdentifier: string, lastError: string) => ({
  identifier: `item-${mediaIdentifier}`,
  mediaIdentifier,
  ownerType: "Trail",
  status: "Failed",
  lastError,
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

    await waitFor(() => expect(screen.getAllByRole("button", { name: /cancel/i })).toHaveLength(1));
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

  it("shows a finished job's failures grouped by reason, largest first", async () => {
    const failedJob = job({ status: "Completed", pendingCount: 0, succeededCount: 1, failedCount: 3, totalCount: 4 });
    mediaApi.getMediaReprocessJobs.mockResolvedValue({ items: [failedJob] });
    mediaApi.getMediaReprocessJob.mockResolvedValue({
      job: failedJob,
      items: [
        {
          identifier: "i1",
          mediaIdentifier: "m1",
          ownerType: "Trail",
          status: "Failed",
          lastError: "Decode: bad header",
        },
        {
          identifier: "i2",
          mediaIdentifier: "m2",
          ownerType: "Trail",
          status: "Failed",
          lastError: "Download: 404 Not Found",
        },
        {
          identifier: "i3",
          mediaIdentifier: "m3",
          ownerType: "Trail",
          status: "Failed",
          lastError: "Download: 404 Not Found",
        },
        { identifier: "i4", mediaIdentifier: "m4", ownerType: "Trail", status: "Succeeded" },
      ],
    });

    render(<MediaReprocessJobs refreshKey={0} />);
    await userEvent.click(await screen.findByRole("button", { name: /show failures/i }));

    const summaries = await screen.findAllByText(/×/);
    expect(summaries.map((s) => s.parentElement?.textContent)).toEqual([
      "2× Download: 404 Not Found",
      "1× Decode: bad header",
    ]);
    expect(mediaApi.getMediaReprocessJob).toHaveBeenCalledWith("job-1");
  });

  it("offers Retry only once a job with failures has settled", async () => {
    mediaApi.getMediaReprocessJobs.mockResolvedValue({
      items: [
        job({ identifier: "job-running", pendingCount: 1, failedCount: 1 }),
        job({ identifier: "job-settled", status: "Completed", pendingCount: 0, failedCount: 1 }),
      ],
    });

    render(<MediaReprocessJobs refreshKey={0} />);

    await waitFor(() => expect(screen.getAllByRole("button", { name: /retry failed/i })).toHaveLength(1));
  });

  it("retries the job's failed items and reloads the list", async () => {
    mediaApi.getMediaReprocessJobs.mockResolvedValue({
      items: [job({ status: "Completed", pendingCount: 0, failedCount: 2 })],
    });
    mediaApi.retryMediaReprocessJob.mockResolvedValue(job({ pendingCount: 2, failedCount: 0 }));

    render(<MediaReprocessJobs refreshKey={0} />);
    await userEvent.click(await screen.findByRole("button", { name: /retry failed/i }));

    expect(mediaApi.retryMediaReprocessJob).toHaveBeenCalledWith("job-1");
    await waitFor(() => expect(mediaApi.getMediaReprocessJobs).toHaveBeenCalledTimes(2));
    expect(toasted.success).toHaveBeenCalledWith("Retrying 2 failed image(s).");
  });

  it("keeps a slow answer for one job's failures out of another job's panel", async () => {
    const settled = { status: "Completed", pendingCount: 0, failedCount: 1 };
    mediaApi.getMediaReprocessJobs.mockResolvedValue({
      items: [job({ identifier: "job-a", ...settled }), job({ identifier: "job-b", ...settled })],
    });
    const slowA = deferred<unknown>();
    mediaApi.getMediaReprocessJob.mockImplementation((id: string) =>
      id === "job-a"
        ? slowA.promise
        : Promise.resolve({ job: job({ identifier: "job-b" }), items: [failedItem("m-b", "Reason B")] }),
    );

    render(<MediaReprocessJobs refreshKey={0} />);
    const [showA] = await screen.findAllByRole("button", { name: /show failures/i });
    await userEvent.click(showA);
    await userEvent.click(screen.getByRole("button", { name: /show failures/i }));
    await screen.findByText("Reason B");

    await act(async () => {
      slowA.resolve({ job: job({ identifier: "job-a" }), items: [failedItem("m-a", "Reason A")] });
      await slowA.promise;
    });

    expect(screen.queryByText("Reason A")).toBeNull();
    expect(screen.getByText("Reason B")).toBeInTheDocument();
  });

  it("shows a failed load as an error with a retry, not as 'no batches yet'", async () => {
    mediaApi.getMediaReprocessJobs.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({ items: [job({})] });

    render(<MediaReprocessJobs refreshKey={0} />);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(screen.queryByText(/no batches yet/i)).toBeNull();
    await waitFor(() => expect(screen.getByText("0/2 succeeded")).toBeInTheDocument());
  });

  it("does not start a poll while the previous one is still loading", async () => {
    // keep-comment: setInterval is captured, not faked with vi.useFakeTimers - fake timers leave the component on "Loading…"; see docs/notes/fake-timers-stall-react-state-in-web-tests.md
    const ticks: (() => void)[] = [];
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void) => {
      ticks.push(fn);
      return 1;
    }) as unknown as typeof setInterval);
    let calls = 0;
    mediaApi.getMediaReprocessJobs.mockImplementation(() => {
      calls += 1;
      return calls === 1 ? Promise.resolve({ items: [job({})] }) : new Promise(() => {});
    });

    render(<MediaReprocessJobs refreshKey={0} />);
    await screen.findByText("0/2 succeeded");
    const tick = ticks.at(-1);
    if (!tick) throw new Error("expected a poll interval");
    tick();
    tick();
    tick();

    expect(mediaApi.getMediaReprocessJobs).toHaveBeenCalledTimes(2);
    setIntervalSpy.mockRestore();
  });

  it("toasts a failing poll once, not every tick", async () => {
    const ticks: (() => void)[] = [];
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void) => {
      ticks.push(fn);
      return 1;
    }) as unknown as typeof setInterval);
    mediaApi.getMediaReprocessJobs.mockResolvedValueOnce({ items: [job({})] }).mockRejectedValue(new Error("down"));

    render(<MediaReprocessJobs refreshKey={0} />);
    await screen.findByText("0/2 succeeded");
    const tick = ticks.at(-1);
    if (!tick) throw new Error("expected a poll interval");
    for (let i = 0; i < 3; i++) {
      tick();
      await waitFor(() => expect(mediaApi.getMediaReprocessJobs).toHaveBeenCalledTimes(i + 2));
    }

    await waitFor(() => expect(toasted.error).toHaveBeenCalled());
    expect(toasted.error).toHaveBeenCalledTimes(1);
    setIntervalSpy.mockRestore();
  });
});
