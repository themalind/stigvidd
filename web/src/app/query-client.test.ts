// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/mutator";

const toasts = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => toasts);

import { createQueryClient, shouldRetry } from "./query-client";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("shouldRetry", () => {
  it("never retries a refusal, which would only be refused again", () => {
    expect(shouldRetry(0, new ApiError("Not found", 404))).toBe(false);
  });

  it("retries a server failure and a dropped connection twice", () => {
    expect(shouldRetry(0, new ApiError("Boom", 503))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(2, new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("the query cache", () => {
  it("leaves a first-load failure to the error boundary", async () => {
    const client = createQueryClient();

    await client
      .fetchQuery({ queryKey: ["first"], queryFn: () => Promise.reject(new ApiError("Nope", 404)) })
      .catch(() => undefined);

    expect(toasts.toast.error).not.toHaveBeenCalled();
  });

  it("toasts a failed background refetch, preferring the query's own message", async () => {
    const client = createQueryClient();
    client.setQueryData(["list"], ["cached"]);

    await client
      .fetchQuery({
        queryKey: ["list"],
        queryFn: () => Promise.reject(new ApiError("Nope", 400)),
        staleTime: 0,
        meta: { errorMessage: "Could not refresh the list." },
      })
      .catch(() => undefined);

    expect(toasts.toast.error).toHaveBeenCalledWith("Could not refresh the list.");
  });
});

describe("the mutation cache", () => {
  it("toasts success and failure from the mutation's meta", async () => {
    const client = createQueryClient();
    const mutations = client.getMutationCache();

    await mutations
      .build(client, { mutationFn: () => Promise.resolve(), meta: { successMessage: "Saved." } })
      .execute(undefined);
    await mutations
      .build(client, { mutationFn: () => Promise.reject(new ApiError("Refused", 409)) })
      .execute(undefined)
      .catch(() => undefined);

    expect(toasts.toast.success).toHaveBeenCalledWith("Saved.");
    expect(toasts.toast.error).toHaveBeenCalledWith("Refused");
  });
});
