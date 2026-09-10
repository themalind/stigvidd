// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

interface JsonNode {
  type?: string;
  props?: Record<string, unknown>;
  children?: unknown[];
}

export interface StrayText {
  text: string;
  // The host types leading to it, e.g. "View > View", so the failure names a place.
  path: string;
}

// Collects strings rendered directly under something other than a Text. On a device each is React
// Native's "Text strings must be rendered within a <Text> component" red box; in a test it is
// invisible, since queryByText only looks inside a Text. The usual source is `{list.length && <X />}`,
// which renders 0 when the list is empty.
export function strayText(node: unknown, path = ""): StrayText[] {
  if (Array.isArray(node)) return node.flatMap((child) => strayText(child, path));
  if (node === null || typeof node !== "object") return [];

  const element = node as JsonNode;
  const type = element.type ?? "?";
  const here = path ? `${path} > ${type}` : type;
  const children = element.children ?? [];
  const own =
    type === "Text"
      ? []
      : children.filter((child): child is string => typeof child === "string").map((text) => ({ text, path: here }));

  return [...own, ...children.flatMap((child) => strayText(child, here))];
}

// The last tree rendered in the current test, handed over by renderWithProviders. The after-each
// hook in jest.after-env.js reads it here rather than importing @testing-library/react-native, whose
// first import during a run registers a cleanup hook inside a test.
interface LastRender {
  toJSON: () => unknown;
}

// Every tree rendered in the current test, not just the last: a test that renders twice would
// otherwise have its first tree go unchecked.
const registry: LastRender[] = [];

export function rememberRender(rendered: LastRender) {
  registry.push(rendered);
}

export function takeRenders(): LastRender[] {
  return registry.splice(0, registry.length);
}

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
