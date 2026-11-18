// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { act, fireEvent } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

// fireEvent also waits for what the handler returns, so a request the test holds open would hang it. keep-comment: RNTL 14 returns the handler's promise from an async function
export async function pressWhileHeld(element: TestInstance) {
  void fireEvent.press(element);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await settle();
}

// keep-comment: use instead of waitFor (docs/notes/app-component-testing-what-layout-can-be-asserted.md)
export async function settle() {
  await act(async () => {});
}

// keep-comment: for chained effects (a modal mounts, then its query fetches)
// keep-comment: macrotask ticks, since react-query settles parts of a query on a zero-delay timer
export async function flushUntil(ready: () => unknown, maxTicks = 20) {
  for (let tick = 0; tick < maxTicks; tick++) {
    if (ready()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

// keep-comment: Paper unmounts when the exit animation ends, not when state hides it
// keep-comment: pass the query, not its result, since it re-runs every tick
export async function flushUntilGone(find: () => unknown) {
  await flushUntil(() => !find());
}
