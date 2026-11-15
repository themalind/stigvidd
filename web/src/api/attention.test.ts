// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { getAdminDashboardGetAttentionQueryKey } from "@/api/generated/admin-dashboard/admin-dashboard";
import { createTestQueryClient } from "@/testing/render";
import { recountAfterMutations } from "./attention";

const COUNTS = { pendingHikeSubmissions: 1, pendingReports: 0, failedMails: 0, importsAwaitingReview: 0 };

function setUp() {
  const client = createTestQueryClient();
  client.setQueryData(getAdminDashboardGetAttentionQueryKey(), COUNTS);
  const stop = recountAfterMutations(client);
  const stale = () => client.getQueryState(getAdminDashboardGetAttentionQueryKey())?.isInvalidated;
  return { client, stop, stale };
}

describe("recountAfterMutations", () => {
  it("marks the counts stale after a mutation succeeds", async () => {
    const { client, stale } = setUp();

    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.resolve("ok") })
      .execute(undefined);

    expect(stale()).toBe(true);
  });

  it("leaves the counts alone when a mutation fails", async () => {
    const { client, stale } = setUp();

    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(new Error("nej")) })
      .execute(undefined)
      .catch(() => undefined);

    expect(stale()).toBe(false);
  });

  it("stops when unsubscribed", async () => {
    const { client, stop, stale } = setUp();

    stop();
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.resolve("ok") })
      .execute(undefined);

    expect(stale()).toBe(false);
  });
});
