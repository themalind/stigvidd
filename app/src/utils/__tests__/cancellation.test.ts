// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { cancellation } from "../cancellation";

describe("cancellation", () => {
  it("starts live", () => {
    expect(cancellation().isCancelled()).toBe(false);
  });

  it("reads as cancelled once cancel has run", () => {
    const { isCancelled, cancel } = cancellation();

    cancel();

    expect(isCancelled()).toBe(true);
  });

  it("keeps each instance separate", () => {
    const first = cancellation();
    const second = cancellation();

    first.cancel();

    expect(second.isCancelled()).toBe(false);
  });
});
