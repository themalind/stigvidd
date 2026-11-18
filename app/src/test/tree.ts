// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// keep-comment: a hook's own gcTime (useTrails: 24 h) overrides the client's 0 and leaves a timer behind;
// keep-comment: disposed in the next beforeEach, after unmount, so clearing re-renders nothing outside act()
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
