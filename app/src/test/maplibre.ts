// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// __mocks__/@maplibre/maplibre-react-native.js records every imperative handle it hands out, so a
// test can assert camera moves that leave no trace in the tree. Those extras are not on the real
// module, so they are reached through the mock.

export interface MapLibreHandle {
  setCamera: jest.Mock;
  fitBounds: jest.Mock;
  flyTo: jest.Mock;
  easeTo: jest.Mock;
  jumpTo: jest.Mock;
  zoomTo: jest.Mock;
  setNativeProps: jest.Mock;
}

export interface SourceHandle {
  getClusterExpansionZoom: jest.Mock;
  getClusterLeaves: jest.Mock;
}

interface MapLibreMock {
  handlesFor: (name: "Map" | "MapView" | "Camera") => MapLibreHandle[];
  handleForId: (id: string) => (MapLibreHandle & SourceHandle) | undefined;
  resetHandles: () => void;
}

const maplibre = jest.requireMock("@maplibre/maplibre-react-native") as MapLibreMock;

// The handles created so far, oldest first; the last tree's camera is cameraHandles().at(-1).
export function cameraHandles() {
  return maplibre.handlesFor("Camera");
}

// A clustered source by the id its owner gave it ("trails", "fire-pits").
export function sourceHandle(id: string) {
  const handle = maplibre.handleForId(id);
  if (!handle) throw new Error(`No MapLibre source rendered with id "${id}"`);
  return handle;
}

// Call in beforeEach: handles outlive the render that made them.
export function resetMapHandles() {
  maplibre.resetHandles();
}
