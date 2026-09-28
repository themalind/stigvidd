// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The race rejects even if the platform ignores the abort. keep-comment: see docs/notes/android-fetch-no-timeout-stale-token-401.md
export async function withTimeout<T>(
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message = "Request timed out",
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([request(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
