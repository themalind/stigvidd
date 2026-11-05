// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MediaReprocessJobDetailResponse, MediaReprocessJobSummaryResponse } from "@/api/generated/model";
import { QueryBoundary } from "@/components/query-boundary";
import { failedItem, jobsPage, reprocessJob as job } from "@/testing/fixtures/media";
import { renderWithProviders } from "@/testing/render";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

import MediaReprocessJobs from "./media-reprocess-jobs";

const JOBS = "/api/v1/admin/media/reprocess";
const settled: Partial<MediaReprocessJobSummaryResponse> = { status: "Completed", pendingCount: 0 };

let jobs: MediaReprocessJobSummaryResponse[] = [];

const listCalls = () => api.mock.calls.filter((call) => call.method === "GET" && call.path === JOBS);

function renderJobs(list: MediaReprocessJobSummaryResponse[]) {
  jobs = list;
  return renderWithProviders(
    <QueryBoundary>
      <MediaReprocessJobs />
    </QueryBoundary>,
  );
}

function detail(identifier: string, items: MediaReprocessJobDetailResponse["items"]): MediaReprocessJobDetailResponse {
  return { job: job({ identifier }), items };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  api.mock.on("GET", JOBS, () => jobsPage(jobs));
});

describe("the batch list", () => {
  it("shows a message when there are no batches yet", async () => {
    renderJobs([]);

    expect(await screen.findByText(/no batches yet/i)).toBeInTheDocument();
  });

  it("lists a job's progress", async () => {
    renderJobs([job({ succeededCount: 1, pendingCount: 1, totalCount: 2, failedCount: 1, cancelledCount: 3 })]);

    expect(await screen.findByText("1/2 succeeded · 1 failed · 3 cancelled")).toBeInTheDocument();
  });

  it("shows a failed load as an error with a retry, not as 'no batches yet'", async () => {
    let call = 0;
    api.mock.on("GET", JOBS, () => {
      if (++call === 1) throw new Error("boom");
      return jobsPage([job({})]);
    });

    renderJobs([]);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(screen.queryByText(/no batches yet/i)).toBeNull();
    expect(await screen.findByText("0/2 succeeded")).toBeInTheDocument();
  });
});

describe("cancelling", () => {
  it("is offered only while a job still has pending items", async () => {
    renderJobs([
      job({ identifier: "job-pending", pendingCount: 1 }),
      job({ identifier: "job-done", ...settled, succeededCount: 2 }),
    ]);

    await waitFor(() => expect(screen.getAllByRole("button", { name: /cancel/i })).toHaveLength(1));
  });

  it("cancels the job and reloads the list", async () => {
    api.mock.on("POST", `${JOBS}/job-1/cancel`, () => {
      jobs = [job({ ...settled, cancelledCount: 2 })];
      return jobs[0];
    });
    renderJobs([job({})]);

    await userEvent.click(await screen.findByRole("button", { name: /cancel/i }));

    expect(await screen.findByText("0/2 succeeded · 2 cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });

  it("says so when the cancel is refused", async () => {
    api.mock.on("POST", `${JOBS}/job-1/cancel`, () => {
      throw new Error("conflict");
    });
    renderJobs([job({})]);

    await userEvent.click(await screen.findByRole("button", { name: /cancel/i }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("Failed to cancel the batch."));
  });
});

describe("failures", () => {
  it("shows a finished job's failures grouped by reason, largest first", async () => {
    api.mock.on("GET", `${JOBS}/job-1`, () =>
      detail("job-1", [
        failedItem("m1", "Decode: bad header"),
        failedItem("m2", "Download: 404 Not Found"),
        failedItem("m3", "Download: 404 Not Found"),
        { ...failedItem("m4", null), status: "Succeeded" },
      ]),
    );
    renderJobs([job({ ...settled, succeededCount: 1, failedCount: 3, totalCount: 4 })]);

    await userEvent.click(await screen.findByRole("button", { name: /show failures/i }));

    const summaries = await screen.findAllByText(/×/);
    expect(summaries.map((s) => s.parentElement?.textContent)).toEqual([
      "2× Download: 404 Not Found",
      "1× Decode: bad header",
    ]);
  });

  it("keeps a slow answer for one job's failures out of another job's panel", async () => {
    let answerA: () => void = () => {};
    api.mock.on(
      "GET",
      `${JOBS}/job-a`,
      () =>
        new Promise((resolve) => {
          answerA = () => resolve(detail("job-a", [failedItem("m-a", "Reason A")]));
        }),
    );
    api.mock.on("GET", `${JOBS}/job-b`, () => detail("job-b", [failedItem("m-b", "Reason B")]));
    renderJobs([
      job({ identifier: "job-a", ...settled, failedCount: 1 }),
      job({ identifier: "job-b", ...settled, failedCount: 1 }),
    ]);

    const [showA, showB] = await screen.findAllByRole("button", { name: /show failures/i });
    await userEvent.click(showA);
    await userEvent.click(showB);
    await screen.findByText("Reason B");
    await act(async () => answerA());

    expect(screen.queryByText("Reason A")).toBeNull();
    expect(screen.getByText("Reason B")).toBeInTheDocument();
  });

  it("says so in the panel when they cannot be loaded", async () => {
    api.mock.on("GET", `${JOBS}/job-1`, () => {
      throw new Error("down");
    });
    renderJobs([job({ ...settled, failedCount: 1 })]);

    await userEvent.click(await screen.findByRole("button", { name: /show failures/i }));

    expect(await screen.findByText("The batch's failures could not be loaded.")).toBeInTheDocument();
  });
});

describe("retrying", () => {
  it("is offered only once a job with failures has settled", async () => {
    renderJobs([
      job({ identifier: "job-running", pendingCount: 1, failedCount: 1 }),
      job({ identifier: "job-settled", ...settled, failedCount: 1 }),
    ]);

    await waitFor(() => expect(screen.getAllByRole("button", { name: /retry failed/i })).toHaveLength(1));
  });

  it("retries the job's failed items and reloads the list", async () => {
    api.mock.on("POST", `${JOBS}/job-1/retry`, () => {
      jobs = [job({ status: "Pending", pendingCount: 2, failedCount: 0 })];
      return jobs[0];
    });
    renderJobs([job({ ...settled, failedCount: 2 })]);

    await userEvent.click(await screen.findByRole("button", { name: /retry failed/i }));

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith("Retrying 2 failed image(s)."));
    expect(await screen.findByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry failed/i })).toBeNull();
  });

  it("closes that job's failures panel, which no longer describes it", async () => {
    api.mock.on("GET", `${JOBS}/job-1`, () => detail("job-1", [failedItem("m1", "Reason")]));
    api.mock.on("POST", `${JOBS}/job-1/retry`, () => job({ pendingCount: 1, failedCount: 1 }));
    renderJobs([job({ ...settled, failedCount: 1 })]);
    await userEvent.click(await screen.findByRole("button", { name: /show failures/i }));
    await screen.findByText("Reason");

    await userEvent.click(screen.getByRole("button", { name: /retry failed/i }));

    await waitFor(() => expect(screen.queryByText("Reason")).toBeNull());
  });

  it("leaves another job's open failures alone", async () => {
    api.mock.on("GET", `${JOBS}/job-b`, () => detail("job-b", [failedItem("m-b", "Reason B")]));
    api.mock.on("POST", `${JOBS}/job-a/retry`, () => job({ identifier: "job-a", pendingCount: 1 }));
    renderJobs([
      job({ identifier: "job-a", ...settled, failedCount: 1 }),
      job({ identifier: "job-b", ...settled, failedCount: 1 }),
    ]);
    const [, showB] = await screen.findAllByRole("button", { name: /show failures/i });
    await userEvent.click(showB);
    await screen.findByText("Reason B");

    const [retryA] = screen.getAllByRole("button", { name: /retry failed/i });
    await userEvent.click(retryA);

    await waitFor(() => expect(toasts.success).toHaveBeenCalled());
    expect(screen.getByText("Reason B")).toBeInTheDocument();
  });
});

describe("while a job is running", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls every three seconds", async () => {
    renderJobs([job({})]);
    await screen.findByText("0/2 succeeded");

    jobs = [job({ succeededCount: 1, pendingCount: 1 })];
    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(await screen.findByText("1/2 succeeded")).toBeInTheDocument();
  });

  it("stops polling once every job has settled", async () => {
    renderJobs([job({ ...settled, succeededCount: 2 })]);
    await screen.findByText("2/2 succeeded");

    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(listCalls()).toHaveLength(1);
  });

  it("does not start a poll while the previous one is still loading", async () => {
    renderJobs([job({})]);
    await screen.findByText("0/2 succeeded");
    api.mock.on("GET", JOBS, () => new Promise(() => {}));

    await act(() => vi.advanceTimersByTimeAsync(9000));

    expect(listCalls()).toHaveLength(2);
  });

  it("toasts a failing poll once, not every tick", async () => {
    renderJobs([job({})]);
    await screen.findByText("0/2 succeeded");
    api.mock.on("GET", JOBS, () => {
      throw new Error("down");
    });

    await act(() => vi.advanceTimersByTimeAsync(9000));

    expect(listCalls().length).toBeGreaterThanOrEqual(4);
    expect(toasts.error).toHaveBeenCalledTimes(1);
    expect(toasts.error).toHaveBeenCalledWith("Failed to load batch jobs.");
    expect(screen.getByText("0/2 succeeded")).toBeInTheDocument();
  });
});
