// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// keep-comment: the mock records its imperative handles, so a test can assert camera moves the tree never shows

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

// keep-comment: oldest first; the last tree's camera is cameraHandles().at(-1)
export function cameraHandles() {
  return maplibre.handlesFor("Camera");
}

export function sourceHandle(id: string) {
  const handle = maplibre.handleForId(id);
  if (!handle) throw new Error(`No MapLibre source rendered with id "${id}"`);
  return handle;
}

// keep-comment: call in beforeEach, since handles outlive their render
export function resetMapHandles() {
  maplibre.resetHandles();
}
