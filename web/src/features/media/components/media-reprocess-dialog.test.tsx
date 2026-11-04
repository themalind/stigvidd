// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReprocessTarget } from "@/features/media/utils/media-reprocess-target";
import { reprocessJob } from "@/testing/fixtures/media";
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

import MediaReprocessDialog from "./media-reprocess-dialog";

const JOBS = "/api/v1/admin/media/reprocess";
const job = reprocessJob({ identifier: "job-9", totalCount: 1187 });

async function pick(label: RegExp | string, option: RegExp | string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

const onOpenChange = vi.fn();
const onSubmitted = vi.fn();

function show(target: ReprocessTarget = { kind: "ids", mediaIdentifiers: ["media-1", "media-2"] }) {
  return renderWithProviders(
    <MediaReprocessDialog open onOpenChange={onOpenChange} target={target} onSubmitted={onSubmitted} />,
  );
}

const startButton = () => screen.getByRole("button", { name: /start batch/i });
const sent = async () => {
  await waitFor(() => expect(api.mock.calls.filter((call) => call.method === "POST")).toHaveLength(1));
  return api.mock.calls.find((call) => call.method === "POST")?.body;
};

beforeEach(() => {
  vi.clearAllMocks();
  api.mock.reset();
  api.mock.on("POST", JOBS, () => job);
});

describe("the options sent", () => {
  it("are the default optimized preset's, for every selected identifier", async () => {
    show();

    await userEvent.click(startButton());

    expect(await sent()).toEqual({
      mediaIdentifiers: ["media-1", "media-2"],
      options: { maxWidth: 800, maxHeight: 800, quality: 50, format: "webp" },
    });
  });

  it("switch to the thumbnail preset's when it is chosen", async () => {
    show();

    await pick("Preset", /Thumbnail/);
    await userEvent.click(startButton());

    expect(await sent()).toMatchObject({ options: { maxWidth: 400, maxHeight: 400, quality: 75, format: "webp" } });
  });

  it("keep the web preset reachable now that optimized is the default", async () => {
    show();

    await pick("Preset", /^Web —/);
    await userEvent.click(startButton());

    expect(await sent()).toMatchObject({ options: { maxWidth: 1600, maxHeight: 1600, quality: 80, format: "webp" } });
  });

  it("carry a custom width and height when Custom resolution is picked", async () => {
    show();

    await pick("Max resolution", "Custom…");
    await userEvent.type(screen.getByLabelText("Max width"), "1234");
    await userEvent.type(screen.getByLabelText("Max height"), "999");
    await userEvent.click(startButton());

    expect(await sent()).toMatchObject({ options: { maxWidth: 1234, maxHeight: 999 } });
  });

  it("carry the filter, not identifiers, in filter mode", async () => {
    const filter = { targetMaxWidth: 800, targetFormat: "webp" };
    show({ kind: "filter", filter, matchingCount: 1204, summary: "needs work" });

    await userEvent.click(startButton());

    expect(await sent()).toEqual({
      filter,
      options: { maxWidth: 800, maxHeight: 800, quality: 50, format: "webp" },
    });
  });
});

describe("the dialog", () => {
  it("names the quality slider for assistive technology", () => {
    show();

    expect(screen.getByRole("slider", { name: "Quality" })).toBeInTheDocument();
  });

  it("states the matching count in filter mode", () => {
    show({ kind: "filter", filter: { targetMaxWidth: 800 }, matchingCount: 1204, summary: "needs work" });

    expect(screen.getByText(/Optimize all 1204 matching images/i)).toBeInTheDocument();
    expect(startButton()).toHaveTextContent("1204");
  });

  it("stops naming a preset once its values have been edited", async () => {
    show();
    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveTextContent(/Optimized/);

    await pick("Max resolution", "1280px");

    expect(screen.getByRole("combobox", { name: "Preset" })).toHaveTextContent(/Custom/);
  });

  // keep-comment: the job's own count, as the server expands a filter again when it creates the job
  it("reports the new job with the server's count, and closes", async () => {
    show({ kind: "filter", filter: {}, matchingCount: 1204, summary: "the whole library" });

    await userEvent.click(startButton());

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(job));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toasts.success).toHaveBeenCalledWith("Batch started for 1187 image(s).");
  });

  it("stays open and shows the server's own message when the request fails", async () => {
    api.mock.on("POST", JOBS, () => {
      throw new Error("boom");
    });
    show();

    await userEvent.click(startButton());

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith("boom"));
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(startButton()).toBeEnabled();
  });
});
