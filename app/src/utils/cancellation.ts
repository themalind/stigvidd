// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// keep-comment: a call, not a flag, so TypeScript cannot pin it to its value before an await
export function cancellation(): { isCancelled: () => boolean; cancel: () => void } {
  let cancelled = false;
  return {
    isCancelled: () => cancelled,
    cancel: () => {
      cancelled = true;
    },
  };
}
