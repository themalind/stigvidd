// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { LngLat } from "@/lib/geometry-edit";
import { handlesOf, SubmissionMap } from "./submission-map";

const { maps, FakeMap } = vi.hoisted(() => {
  const maps: InstanceType<typeof FakeMap>[] = [];

  class FakeMap {
    handlers: Record<string, (() => void)[]> = {};
    sources: Record<string, unknown> = {};
    layers: string[] = [];
    styles: { diff?: boolean }[] = [];
    constructor() {
      maps.push(this);
    }
    on(event: string, layerOrHandler: unknown, handler?: () => void) {
      const fn = (handler ?? layerOrHandler) as () => void;
      (this.handlers[event] ??= []).push(fn);
    }
    emit(event: string) {
      this.handlers[event]?.forEach((fn) => fn());
    }
    isStyleLoaded() {
      return false;
    }
    setStyle(_style: unknown, options?: { diff?: boolean }) {
      this.styles.push(options ?? {});
    }
    getSource(id: string) {
      return id in this.sources ? { setData: (data: unknown) => (this.sources[id] = data) } : undefined;
    }
    addSource(id: string, spec: { data: unknown }) {
      this.sources[id] = spec.data;
    }
    getLayer(id: string) {
      return this.layers.includes(id) ? {} : undefined;
    }
    addLayer(layer: { id: string }) {
      this.layers.push(layer.id);
    }
    addControl() {}
    fitBounds() {}
    getCanvas() {
      return { style: {} };
    }
    remove() {}
  }

  return { maps, FakeMap };
});

vi.mock("maplibre-gl", () => {
  class LngLatBounds {
    extend() {
      return this;
    }
  }
  class Control {}
  return {
    default: { Map: FakeMap, LngLatBounds, NavigationControl: Control, ScaleControl: Control },
  };
});

const PATH: LngLat[] = [
  [12.9, 57.7],
  [12.91, 57.71],
  [12.92, 57.72],
];

function show(satellite = false) {
  return render(
    <SubmissionMap
      path={PATH}
      keptRange={[0, 2]}
      jumps={[]}
      mode="move"
      satellite={satellite}
      redrawAnchors={[]}
      draft={[]}
      focus={null}
      onMovePoint={vi.fn()}
      onInsertPoint={vi.fn()}
      onPointClick={vi.fn()}
      onMapClick={vi.fn()}
    />,
  );
}

beforeEach(() => {
  maps.length = 0;
});

it("draws the line as soon as the style loads, before the tiles have arrived", () => {
  show();
  const map = maps[0];

  map.emit("style.load");

  expect(map.layers).toContain("kept-line");
  expect(map.sources.kept).toMatchObject({
    features: [{ geometry: { type: "LineString", coordinates: PATH } }],
  });
});

it("offers a handle halfway along each segment, only while moving points", () => {
  expect(handlesOf(PATH, "move").features.map((f) => f.properties)).toEqual([{ index: 0 }, { index: 1 }]);
  expect(handlesOf(PATH, "delete").features).toHaveLength(0);

  show();
  maps[0].emit("style.load");

  expect(maps[0].layers).toContain("handles");
});

it("draws nothing before the style has loaded", () => {
  show();

  expect(maps[0].layers).toHaveLength(0);
});

it("redraws after the satellite toggle replaces the style", () => {
  const { rerender } = show();
  const map = maps[0];
  map.emit("style.load");

  rerender(
    <SubmissionMap
      path={PATH}
      keptRange={[0, 2]}
      jumps={[]}
      mode="move"
      satellite
      redrawAnchors={[]}
      draft={[]}
      focus={null}
      onMovePoint={vi.fn()}
      onInsertPoint={vi.fn()}
      onPointClick={vi.fn()}
      onMapClick={vi.fn()}
    />,
  );
  map.layers = [];
  map.sources = {};
  map.emit("style.load");

  expect(map.styles.at(-1)).toEqual({ diff: false });
  expect(map.layers).toContain("kept-line");
});
