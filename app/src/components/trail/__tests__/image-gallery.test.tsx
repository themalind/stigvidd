// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ImageGallery from "@/components/trail/image-gallery";
import { TrailImage } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, screen } from "@testing-library/react-native";

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

    fireEvent(screen.getByTestId("gallery-focus-image"), "load", { nativeEvent: {} });

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

    fireEvent(screen.getByTestId("gallery-focus-image"), "load", { nativeEvent: {} });

    expect(screen.getByTestId("gallery-thumb-0")).toBe(loaded);
  });

  it("does not retry a failure on its own failed attempt", () => {
    show();
    fireEvent(screen.getByTestId("gallery-thumb-1"), "error", { nativeEvent: { error: "timeout" } });
    fireEvent(screen.getByTestId("gallery-focus-image"), "load", { nativeEvent: {} });
    const retried = screen.getByTestId("gallery-thumb-1");

    fireEvent(retried, "error", { nativeEvent: { error: "timeout" } });

    expect(screen.getByTestId("gallery-thumb-1")).toBe(retried);
  });
});

it("shows the tapped image in the large view", () => {
  show();

  fireEvent.press(screen.getByTestId("gallery-thumb-2"));

  expect(JSON.stringify(screen.getByTestId("gallery-focus-image").props.source)).toContain("c.jpg");
});
