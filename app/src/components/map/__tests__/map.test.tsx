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

it("renders as a TextureView on Android, so it fades with the screen transition", async () => {
  await render(<Map />);

  expect(map().props.androidView).toBe("texture");
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

  it("still fades the cover when the caller listens for the full render too", async () => {
    const onRendered = jest.fn();
    await render(<Map onDidFinishRenderingMapFully={onRendered} />);

    await act(async () => {
      map().props.onDidFinishRenderingMapFully("rendered");
    });

    expect(fadeOuts()).toHaveLength(1);
    expect(onRendered).toHaveBeenCalledWith("rendered");
  });

  it("still fades the cover when the caller listens for a failed load too", async () => {
    const onFailed = jest.fn();
    await render(<Map onDidFailLoadingMap={onFailed} />);

    await act(async () => {
      map().props.onDidFailLoadingMap("failed");
    });

    expect(fadeOuts()).toHaveLength(1);
    expect(onFailed).toHaveBeenCalledWith("failed");
  });

  it("waits for a render after the content arrives, so the camera's jump to it stays behind the cover", async () => {
    const { rerender } = await render(<Map contentReady={false} />);

    await act(async () => {
      map().props.onDidFinishRenderingMapFully();
    });
    expect(fadeOuts()).toHaveLength(0);

    await rerender(<Map contentReady />);
    await act(async () => {
      map().props.onDidFinishRenderingMapFully();
    });

    expect(fadeOuts()).toHaveLength(1);
  });

  it("shows the map anyway when the content never arrives", async () => {
    await render(<Map contentReady={false} />);

    await advance(MAP_REVEAL_FALLBACK_MS);

    expect(fadeOuts()).toHaveLength(1);
  });

  it("shows a spinner while covered and removes it once the map has rendered", async () => {
    await render(<Map />);
    expect(screen.getByTestId("map-loading-spinner")).toBeTruthy();

    await act(async () => {
      map().props.onDidFinishRenderingMapFully();
    });

    expect(screen.queryByTestId("map-loading-spinner")).toBeNull();
  });

  it("keeps the spinner while the content is still loading after the fallback reveal", async () => {
    const { rerender } = await render(<Map contentReady={false} />);

    await advance(MAP_REVEAL_FALLBACK_MS);
    expect(screen.getByTestId("map-loading-spinner")).toBeTruthy();

    await rerender(<Map contentReady />);

    expect(screen.queryByTestId("map-loading-spinner")).toBeNull();
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
