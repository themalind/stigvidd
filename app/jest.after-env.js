// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

const { strayText, takeRenders, takeQueryClients } = require("./src/test/tree");

// A string rendered under anything but a Text is a red box on a device and invisible to every query,
// so every tree renderWithProviders hands over is checked here.
//
// Declared before @testing-library/react-native is imported anywhere, so it runs ahead of the
// library's own cleanup. For the same reason it must not import the library: a first import during
// a run would register that cleanup inside a test, which Jest refuses.
afterEach(() => {
  const stray = takeRenders().flatMap((rendered) => {
    try {
      return strayText(rendered.toJSON());
    } catch {
      return []; // the test unmounted it itself
    }
  });
  if (stray.length === 0) return;

  const found = stray.map((s) => `  "${s.text}" under ${s.path}`).join("\n");
  throw new Error(
    `Rendered ${stray.length} string(s) outside a <Text>, which React Native throws on:\n${found}\n` +
      `The usual cause is a falsy-but-renderable guard: {list.length && <X />} renders 0 when the ` +
      `list is empty. Write {!!list.length && <X />}.`,
  );
});

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
