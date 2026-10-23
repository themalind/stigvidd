// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ImageGallery from "@/components/trail/image-gallery";
import { TrailImage } from "@/data/types";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Dimensions, FlatList } from "react-native";

const IMAGES: TrailImage[] = [
  { identifier: "a", imageUrl: "https://media.stigvidd.se/a.jpg" },
  { identifier: "b", imageUrl: "https://media.stigvidd.se/b.jpg" },
  { identifier: "c", imageUrl: "https://media.stigvidd.se/c.jpg" },
];

function show() {
  return renderWithProviders(<ImageGallery images={IMAGES} />);
}

afterEach(() => {
  onlineManager.setOnline(true);
});

describe("ImageGallery — a thumbnail that failed on a weak connection", () => {
  it("loads again once the large image gets through", () => {
    show();
    const failed = screen.getByTestId("gallery-thumb-1");
    fireEvent(failed, "error", { nativeEvent: { error: "timeout" } });

    fireEvent(screen.getByTestId("gallery-page-0"), "load", { nativeEvent: {} });

    expect(screen.getByTestId("gallery-thumb-1")).not.toBe(failed);
  });

  it("loads again once another thumbnail gets through", () => {
    show();
    const failed = screen.getByTestId("gallery-thumb-1");
    fireEvent(failed, "error", { nativeEvent: { error: "timeout" } });

    fireEvent(screen.getByTestId("gallery-thumb-2"), "load", { nativeEvent: {} });

    expect(screen.getByTestId("gallery-thumb-1")).not.toBe(failed);
  });

  it("loads again when the user taps it", () => {
    show();
    const failed = screen.getByTestId("gallery-thumb-1");
    fireEvent(failed, "error", { nativeEvent: { error: "timeout" } });

    fireEvent.press(failed);

    expect(screen.getByTestId("gallery-thumb-1")).not.toBe(failed);
  });

  it("loads again when the connection comes back", async () => {
    onlineManager.setOnline(false);
    show();
    const failed = screen.getByTestId("gallery-thumb-1");
    fireEvent(failed, "error", { nativeEvent: { error: "timeout" } });

    await act(async () => onlineManager.setOnline(true));

    expect(screen.getByTestId("gallery-thumb-1")).not.toBe(failed);
  });

  it("leaves the thumbnails that did load alone", () => {
    show();
    const loaded = screen.getByTestId("gallery-thumb-0");
    fireEvent(screen.getByTestId("gallery-thumb-1"), "error", { nativeEvent: { error: "timeout" } });

    fireEvent(screen.getByTestId("gallery-page-0"), "load", { nativeEvent: {} });

    expect(screen.getByTestId("gallery-thumb-0")).toBe(loaded);
  });

  it("does not retry a failure on its own failed attempt", () => {
    show();
    fireEvent(screen.getByTestId("gallery-thumb-1"), "error", { nativeEvent: { error: "timeout" } });
    fireEvent(screen.getByTestId("gallery-page-0"), "load", { nativeEvent: {} });
    const retried = screen.getByTestId("gallery-thumb-1");

    fireEvent(retried, "error", { nativeEvent: { error: "timeout" } });

    expect(screen.getByTestId("gallery-thumb-1")).toBe(retried);
  });
});

function selected(index: number) {
  return screen.getByTestId(`gallery-thumb-button-${index}`).props.accessibilityState?.selected;
}

describe("ImageGallery — large image and thumbnails follow each other", () => {
  it("starts on the first image", () => {
    show();

    expect(selected(0)).toBe(true);
    expect(selected(1)).toBe(false);
  });

  it("pages the large view to the tapped thumbnail", () => {
    show();
    const scrollToIndex = jest.spyOn(FlatList.prototype, "scrollToIndex").mockImplementation(() => {});

    fireEvent.press(screen.getByTestId("gallery-thumb-2"));

    expect(scrollToIndex).toHaveBeenCalledWith({ index: 2, animated: true });
    expect(selected(2)).toBe(true);
    expect(selected(0)).toBe(false);
    scrollToIndex.mockRestore();
  });

  it("marks the thumbnail of the image swiped to", () => {
    show();
    const { width } = Dimensions.get("window");

    fireEvent(screen.getByTestId("gallery-pager"), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: width * 2 } },
    });

    expect(selected(2)).toBe(true);
    expect(selected(0)).toBe(false);
  });

  it("shows every image as a page of its own", () => {
    show();

    expect(JSON.stringify(screen.getByTestId("gallery-page-2").props.source)).toContain("c.jpg");
  });

  it("opens the full-screen viewer on the image tapped", () => {
    show();
    fireEvent.press(screen.getByTestId("gallery-thumb-1"));

    fireEvent.press(screen.getByTestId("gallery-page-button-1"));

    expect(screen.getByTestId("image-viewer-close")).toBeTruthy();
    expect(screen.getByTestId("review-image-list").props.initialScrollIndex).toBe(1);
  });

  it("lands on the image the viewer was closed on", async () => {
    show();
    fireEvent.press(screen.getByTestId("gallery-page-button-0"));
    const { width } = Dimensions.get("window");
    fireEvent(screen.getByTestId("review-image-list"), "momentumScrollEnd", {
      nativeEvent: { contentOffset: { x: width * 2 } },
    });

    fireEvent.press(screen.getByTestId("image-viewer-close"));
    await settle();

    expect(selected(2)).toBe(true);
  });

  it("hides the thumbnail row for a single image", () => {
    renderWithProviders(<ImageGallery images={[IMAGES[0]]} />);

    expect(screen.getByTestId("gallery-page-0")).toBeTruthy();
    expect(screen.queryByTestId("gallery-thumb-0")).toBeNull();
  });
});
