// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { vi } from "vitest";

type Handler = (body: unknown) => unknown;

export interface ApiCall {
  method: string;
  url: string;
  path: string;
  body: unknown;
}

export function createApiMock() {
  const handlers = new Map<string, Handler>();
  const calls: ApiCall[] = [];

  const customFetch = vi.fn(async (url: string, options: RequestInit = {}) => {
    const method = (options.method ?? "GET").toUpperCase();
    const path = url.split("?")[0];
    const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    calls.push({ method, url, path, body });

    const handler = handlers.get(`${method} ${path}`);
    if (!handler) throw new Error(`No API mock for ${method} ${path}`);
    return handler(body);
  });

  return {
    customFetch,
    calls,
    on(method: string, path: string, handler: Handler) {
      handlers.set(`${method.toUpperCase()} ${path}`, handler);
    },
    reset() {
      handlers.clear();
      calls.length = 0;
      customFetch.mockClear();
    },
  };
}
