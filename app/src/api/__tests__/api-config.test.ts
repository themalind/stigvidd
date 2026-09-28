// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { API_REQUEST_TIMEOUT_MS, apiFetch } from "@/api/api-config";

afterEach(() => {
  jest.useRealTimers();
});

it("gives up on a request that never answers, and aborts it", async () => {
  jest.useFakeTimers();
  let signal: AbortSignal | undefined;
  global.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>(() => {});
  });

  const settled = expect(apiFetch("http://test/api/v1/trails")).rejects.toThrow("API request timed out");
  await jest.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
  await settled;

  expect(signal?.aborted).toBe(true);
});

it("passes the caller's options through and returns the response", async () => {
  const response = { ok: true } as Response;
  global.fetch = jest.fn().mockResolvedValue(response);

  await expect(apiFetch("http://test/api/v1/trails", { method: "POST" })).resolves.toBe(response);
  expect(global.fetch).toHaveBeenCalledWith(
    "http://test/api/v1/trails",
    expect.objectContaining({ method: "POST", signal: expect.any(Object) }),
  );
});
