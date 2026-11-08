// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

const { takeQueryClients } = require("./src/test/tree");

// A query hook may set a gcTime that outlives the test — useTrails asks for 24 hours — and each
// unclaimed client leaves a timer of that length behind, keeping the Jest worker alive. Clearing
// happens here, before the next test renders, so the tree is already unmounted and nothing
// re-renders outside act().
function disposeQueryClients() {
  for (const client of takeQueryClients()) {
    try {
      client.clear();
    } catch {
      // A client the test already disposed of is nothing to report.
    }
  }
}

beforeEach(disposeQueryClients);
afterAll(disposeQueryClients);
