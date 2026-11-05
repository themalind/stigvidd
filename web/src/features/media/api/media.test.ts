// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { libraryPage, mediaItem } from "@/testing/fixtures/media";

const api = await vi.hoisted(async () => {
  const { createApiMock } = await import("@/testing/mock-api");
  return { mock: createApiMock() };
});
vi.mock("@/api/mutator", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/mutator")>()),
  customFetch: api.mock.customFetch,
}));

import { getMediaForOwner } from "./media";

const MEDIA = "/api/v1/admin/media";
const pageOf = (identifiers: string[], hasMore: boolean) =>
  libraryPage(
    identifiers.map((identifier) => mediaItem({ identifier })),
    { hasMore },
  );

beforeEach(() => {
  api.mock.reset();
});

describe("getMediaForOwner", () => {
  it("asks for one owner rather than walking the whole library", async () => {
    api.mock.on("GET", MEDIA, () => pageOf(["a"], false));

    await getMediaForOwner("trail-1");

    expect(api.mock.calls).toHaveLength(1);
    const query = new URLSearchParams(api.mock.calls[0].url.split("?")[1]);
    expect(query.get("OwnerIdentifier")).toBe("trail-1");
    expect(query.get("Page")).toBe("1");
  });

  it("keeps going past the first page, which caps at 200", async () => {
    let call = 0;
    api.mock.on("GET", MEDIA, () => (++call === 1 ? pageOf(["a", "b"], true) : pageOf(["c"], false)));

    const media = await getMediaForOwner("trail-1");

    expect(media.map((m) => m.identifier)).toEqual(["a", "b", "c"]);
    expect(new URLSearchParams(api.mock.calls[1].url.split("?")[1]).get("Page")).toBe("2");
  });

  it("stops at a ceiling rather than spinning on a server that always says there is more", async () => {
    api.mock.on("GET", MEDIA, () => pageOf(["a"], true));

    const media = await getMediaForOwner("trail-1");

    expect(api.mock.calls).toHaveLength(20);
    expect(media).toHaveLength(20);
  });
});
