// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export class ApiError extends Error {
  status?: number;
  code?: string;
  problem?: Record<string, unknown>;

  constructor(message: string, status?: number, code?: string, problem?: Record<string, unknown>) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.problem = problem;
  }
}

export function isApiStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

export function apiErrorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

// Coded errors are ProblemDetails with a `code`; uncoded ones are plain strings. keep-comment: the backend's two error shapes
export async function apiErrorFrom(response: Response, message: string): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (body !== null && typeof body === "object" && "code" in body && typeof body.code === "string") {
    return new ApiError(message, response.status, body.code, body as Record<string, unknown>);
  }
  return new ApiError(message, response.status);
}

// The string list a coded error carries under `key`, e.g. the unknown nicknames of an invite. keep-comment: extensions are untyped on the wire
export function problemStrings(error: unknown, key: string): string[] {
  if (!(error instanceof ApiError)) return [];
  const value = error.problem?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
