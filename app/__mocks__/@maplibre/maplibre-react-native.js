// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// MapLibre's entry point calls TurboModuleRegistry.getEnforcing at import time, which throws under
// Jest. Each component renders as a View carrying its props, so a test can assert what the map was handed.
const React = require("react");
const { View } = require("react-native");

// Camera moves go through an imperative handle and leave no trace in the tree, so every handle
// created is kept here, newest last (see handlesFor).
const handles = { Map: [], MapView: [], Camera: [], GeoJSONSource: [], ShapeSource: [] };
// A source is identified by the id its owner gave it ("trails", "fire-pits").
const byId = new Map();

const component = (name) => {
  const Mock = React.forwardRef(({ children, ...props }, ref) => {
    const handle = React.useRef(null);
    if (handle.current === null) {
      handle.current = {
        setCamera: jest.fn(),
        fitBounds: jest.fn(),
        flyTo: jest.fn(),
        easeTo: jest.fn(),
        jumpTo: jest.fn(),
        zoomTo: jest.fn(),
        setNativeProps: jest.fn(),
        getClusterExpansionZoom: jest.fn().mockResolvedValue(0),
        getClusterLeaves: jest.fn().mockResolvedValue([]),
      };
      if (handles[name]) handles[name].push(handle.current);
      if (props.id) byId.set(props.id, handle.current);
    }
    React.useImperativeHandle(ref, () => handle.current);
    return React.createElement(View, { testID: `maplibre-${name}`, ...props }, children);
  });
  Mock.displayName = `MapLibre.${name}`;
  return Mock;
};

// The handles for one component, e.g. handlesFor("Camera").at(-1) for the current tree's camera.
// Call resetHandles() in beforeEach.
const handlesFor = (name) => handles[name] ?? [];
const handleForId = (id) => byId.get(id);
const resetHandles = () => {
  for (const name of Object.keys(handles)) handles[name].length = 0;
  byId.clear();
};

module.exports = {
  Map: component("Map"),
  MapView: component("MapView"),
  Camera: component("Camera"),
  GeoJSONSource: component("GeoJSONSource"),
  ShapeSource: component("ShapeSource"),
  Layer: component("Layer"),
  Marker: component("Marker"),
  MarkerView: component("MarkerView"),
  PointAnnotation: component("PointAnnotation"),
  UserLocation: component("UserLocation"),
  Images: component("Images"),

  useCurrentPosition: jest.fn(() => null),

  handlesFor,
  handleForId,
  resetHandles,

  LogManager: { onLog: jest.fn(), setLogLevel: jest.fn() },
  TransformRequestManager: { addHeader: jest.fn(), removeHeader: jest.fn() },
  OfflineManager: {
    setMaximumAmbientCacheSize: jest.fn().mockResolvedValue(undefined),
    invalidateAmbientCache: jest.fn().mockResolvedValue(undefined),
    clearAmbientCache: jest.fn().mockResolvedValue(undefined),
    resetDatabase: jest.fn().mockResolvedValue(undefined),
  },
};
