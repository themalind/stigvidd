// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Map, { MAP_FADE_MS, MAP_REVEAL_FALLBACK_MS } from "@/components/map/map";
import { SCREEN_PADDING } from "@/constants/constants";
import { act, render, screen } from "@testing-library/react-native";
import React from "react";
import { Animated, StyleSheet } from "react-native";

function map() {
  return screen.getByTestId("maplibre-Map");
}

function logo() {
  return screen.getByTestId("maptiler-logo");
}

it("shows the MapTiler logo in the bottom-left corner by default", async () => {
  await render(<Map />);

  expect(logo()).toHaveStyle({ bottom: SCREEN_PADDING, left: SCREEN_PADDING, width: 67, height: 20 });
});

it("keeps the attribution button on, beside the logo", async () => {
  await render(<Map />);

  expect(map().props.attribution).toBe(true);
  expect(map().props.attributionPosition).toEqual({ bottom: SCREEN_PADDING, left: SCREEN_PADDING + 67 + 4 });
});

it("follows the caller's attribution position", async () => {
  await render(<Map attributionPosition={{ top: 30, left: 12 }} />);

  expect(logo()).toHaveStyle({ top: 30, left: 12 });
  expect(map().props.attributionPosition).toEqual({ top: 30, left: 12 + 67 + 4 });
});

it("moves a right-anchored attribution button inwards, away from the logo", async () => {
  await render(<Map attributionPosition={{ bottom: 8, right: 8 }} />);

  expect(logo()).toHaveStyle({ bottom: 8, right: 8 });
  expect(map().props.attributionPosition).toEqual({ bottom: 8, right: 8 + 67 + 4 });
});

describe("loading cover", () => {
  let timing: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    timing = jest.spyOn(Animated, "timing");
  });

  afterEach(() => {
    timing.mockRestore();
    jest.useRealTimers();
  });

  async function advance(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  }

  function fadeOuts() {
    return timing.mock.calls.filter(([, config]) => config.toValue === 0);
  }

  it("covers the blank map until it has rendered, then fades the cover out once", async () => {
    await render(<Map />);
    expect(StyleSheet.flatten(screen.getByTestId("map-loading-cover").props.style).opacity).toBe(1);
    expect(fadeOuts()).toHaveLength(0);

    await act(async () => {
      map().props.onDidFinishRenderingMapFully();
      map().props.onDidFinishRenderingMapFully();
    });
    await advance(MAP_REVEAL_FALLBACK_MS);

    expect(fadeOuts()).toHaveLength(1);
    expect(fadeOuts()[0][1]).toEqual(expect.objectContaining({ duration: MAP_FADE_MS }));
  });

  it("shows the map when it fails to load", async () => {
    await render(<Map />);

    await act(async () => {
      map().props.onDidFailLoadingMap();
    });

    expect(fadeOuts()).toHaveLength(1);
  });

  it("shows the map anyway when it never reports a full render", async () => {
    await render(<Map />);

    await advance(MAP_REVEAL_FALLBACK_MS - 1);
    expect(fadeOuts()).toHaveLength(0);
    await advance(1);

    expect(fadeOuts()).toHaveLength(1);
  });

  it("lets touches through to the map", async () => {
    await render(<Map />);

    expect(screen.getByTestId("map-loading-cover").props.pointerEvents).toBe("none");
  });
});

it("gives the caller's style to the frame and fills it with the map", async () => {
  const { toJSON } = await render(<Map style={{ height: 180 }} />);

  expect(toJSON()).toHaveStyle({ height: 180 });
  expect(map()).toHaveStyle(StyleSheet.absoluteFill);
});
