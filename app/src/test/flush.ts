// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { act } from "@testing-library/react-native";

// Lets everything already in flight resolve. Use after an interaction instead of waitFor; see
// docs/notes/app-component-testing-what-layout-can-be-asserted.md.
export async function settle() {
  await act(async () => {});
}

// Flushes until `ready()` says the thing under test is there, for effects that only start once an
// earlier one has landed — a modal mounts, and the query it enables fetches after that.
//
// Each tick yields a macrotask, not just microtasks: react-query settles parts of a query through
// a zero-delay timer.
export async function flushUntil(ready: () => unknown, maxTicks = 20) {
  for (let tick = 0; tick < maxTicks; tick++) {
    if (ready()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

// Waits for a Paper Dialog or Modal to unmount, which happens when its exit animation ends rather
// than when the state that hid it changes. renderWithProviders scales those animations to zero.
// Pass the query, not its result: it is re-run on every tick.
export async function flushUntilGone(find: () => unknown) {
  await flushUntil(() => !find());
}
