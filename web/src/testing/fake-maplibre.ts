// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// keep-comment: use as vi.mock("maplibre-gl", () => import("@/testing/fake-maplibre")); jsdom has no WebGL
export const maps: FakeMap[] = [];

type Handler = (...args: unknown[]) => void;

export class FakeMap {
  handlers: Record<string, Handler[]> = {};
  sources: Record<string, unknown> = {};
  layers: string[] = [];
  visibility: Record<string, string> = {};
  styles: { diff?: boolean }[] = [];
  fits = 0;
  markers: FakeMarker[] = [];

  constructor() {
    maps.push(this);
  }
  on(event: string, layerOrHandler: unknown, handler?: Handler) {
    const fn = handler ?? layerOrHandler;
    if (typeof fn === "function") (this.handlers[event] ??= []).push(fn as Handler);
  }
  emit(event: string) {
    this.handlers[event]?.forEach((fn) => fn());
  }
  loadStyle() {
    this.layers = [];
    this.sources = {};
    this.visibility = {};
    this.emit("style.load");
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
  setLayoutProperty(layer: string, _name: string, value: string) {
    this.visibility[layer] = value;
  }
  addControl() {}
  fitBounds() {
    this.fits += 1;
  }
  getCanvas() {
    return { style: {} };
  }
  queryRenderedFeatures() {
    return [];
  }
  remove() {}
}

export class FakeMarker {
  element: HTMLElement;
  position: [number, number] = [0, 0];

  constructor(options: { element: HTMLElement }) {
    this.element = options.element;
  }
  setLngLat(position: [number, number]) {
    this.position = position;
    return this;
  }
  addTo(map: FakeMap) {
    map.markers.push(this);
    return this;
  }
  remove() {
    for (const map of maps) map.markers = map.markers.filter((marker) => marker !== this);
  }
}

export class LngLatBounds {
  extend() {
    return this;
  }
}

class Control {}

export { FakeMap as Map, FakeMarker as Marker, Control as NavigationControl, Control as ScaleControl };

export function setWorkerUrl() {}
