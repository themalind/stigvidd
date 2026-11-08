// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Every QueryClient renderWithProviders has built, so the setup file can dispose them. A hook with
// its own gcTime — useTrails asks for 24 hours — overrides the client's gcTime: 0 and leaves a timer
// of that length behind per test. Disposal runs in the next test's beforeEach, with the tree already
// unmounted, so clearing cannot re-render anything outside act().
interface Disposable {
  clear: () => void;
}

const clients: Disposable[] = [];

export function rememberQueryClient(client: Disposable) {
  clients.push(client);
}

export function takeQueryClients(): Disposable[] {
  return clients.splice(0, clients.length);
}
