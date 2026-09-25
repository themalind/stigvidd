// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaItemResponse, MediaLibraryPageResponse } from "./generated/model";

const generated = vi.hoisted(() => ({ adminMediaGetAll: vi.fn() }));
vi.mock("./generated/admin-media/admin-media", () => ({
  adminMediaGetAll: generated.adminMediaGetAll,
  adminMediaCancelReprocessJob: vi.fn(),
  adminMediaCreateReprocessJob: vi.fn(),
  adminMediaGetReprocessJob: vi.fn(),
  adminMediaGetReprocessJobs: vi.fn(),
  adminMediaUpdateMetadata: vi.fn(),
}));

import { getMediaForOwner } from "./media";

const item = (identifier: string) => ({ identifier }) as MediaItemResponse;

const pageOf = (identifiers: string[], hasMore: boolean) =>
  ({ items: identifiers.map(item), hasMore }) as MediaLibraryPageResponse;

beforeEach(() => {
  generated.adminMediaGetAll.mockReset();
});

describe("getMediaForOwner", () => {
  it("asks for one owner rather than walking the whole library", async () => {
    generated.adminMediaGetAll.mockResolvedValue(pageOf(["a"], false));

    await getMediaForOwner("trail-1");

    expect(generated.adminMediaGetAll).toHaveBeenCalledTimes(1);
    expect(generated.adminMediaGetAll).toHaveBeenCalledWith(
      expect.objectContaining({ OwnerIdentifier: "trail-1", Page: 1 }),
    );
  });

  it("keeps going past the first page, which caps at 200", async () => {
    generated.adminMediaGetAll
      .mockResolvedValueOnce(pageOf(["a", "b"], true))
      .mockResolvedValueOnce(pageOf(["c"], false));

    const media = await getMediaForOwner("trail-1");

    expect(media.map((m) => m.identifier)).toEqual(["a", "b", "c"]);
    expect(generated.adminMediaGetAll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ Page: 2 }),
    );
  });

  it("stops at a ceiling rather than spinning on a server that always says there is more", async () => {
    generated.adminMediaGetAll.mockResolvedValue(pageOf(["a"], true));

    const media = await getMediaForOwner("trail-1");

    expect(generated.adminMediaGetAll).toHaveBeenCalledTimes(20);
    expect(media).toHaveLength(20);
  });
});
