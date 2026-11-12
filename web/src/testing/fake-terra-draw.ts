// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// keep-comment: use as vi.mock("terra-draw", () => import("@/testing/fake-terra-draw")) with the adapter mocked too; jsdom has no WebGL
import type { GeoJSONStoreFeatures } from "terra-draw";

export const draws: FakeTerraDraw[] = [];

type Listener = (...args: unknown[]) => void;

export class FakeTerraDraw {
  features: GeoJSONStoreFeatures[] = [];
  mode = "static";
  started = false;
  listeners: Record<string, Listener[]> = {};

  constructor() {
    draws.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.started = false;
  }
  setMode(mode: string) {
    this.mode = mode;
  }
  addFeatures(features: GeoJSONStoreFeatures[]) {
    this.features.push(...features);
    return features.map((feature) => ({ id: feature.id, valid: true }));
  }
  removeFeatures(ids: unknown[]) {
    this.features = this.features.filter((feature) => !ids.includes(feature.id));
  }
  deselectFeature() {}
  getSnapshot() {
    return this.features;
  }
  on(event: string, listener: Listener) {
    (this.listeners[event] ??= []).push(listener);
  }
  emit(event: string, ...args: unknown[]) {
    this.listeners[event]?.forEach((listener) => listener(...args));
  }
  // keep-comment: stands in for the user reshaping the parts on the map
  replaceWith(features: GeoJSONStoreFeatures[]) {
    this.features = features;
    this.emit(
      "change",
      features.map((feature) => feature.id),
      "update",
    );
  }
}

export { FakeTerraDraw as TerraDraw };

export class TerraDrawPolygonMode {}
export class TerraDrawSelectMode {}
export const ValidateNotSelfIntersecting = () => ({ valid: true });
export class TerraDrawMapLibreGLAdapter {}
