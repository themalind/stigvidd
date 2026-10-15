// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import HikeImageSection from "@/components/hike/hike-image-section";
import { BORDER_RADIUS } from "@/constants/constants";
import { HikeImage } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Image } from "expo-image";
import { StyleSheet } from "react-native";

const onAdd = jest.fn();
const onOpen = jest.fn();

function images(count: number): HikeImage[] {
  return Array.from({ length: count }, (_, i) => ({
    identifier: `img-${i}`,
    imageUrl: `https://media.stigvidd.se/hikes/${i}.jpg`,
  }));
}

function show({ list = images(0), canEdit = true, uploadingCount = 0 } = {}) {
  return renderWithProviders(
    <HikeImageSection images={list} onOpen={onOpen} edit={canEdit ? { max: 10, uploadingCount, onAdd } : undefined} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("without images", () => {
  it("invites the owner to add some, over the whole width", () => {
    show();

    const empty = screen.getByTestId("hike-images-empty");
    expect(screen.getByText("Lägg till bilder")).toBeTruthy();
    expect(screen.getByText("Upp till 10 bilder från turen")).toBeTruthy();

    fireEvent.press(empty);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("draws the invitation dashed, not as a filled card", () => {
    show();

    const style = StyleSheet.flatten(screen.getByTestId("hike-images-empty").props.style);
    expect(style.borderStyle).toBe("dashed");
  });

  it("shows nothing at all to someone the hike was shared with", () => {
    show({ canEdit: false });

    expect(screen.queryByTestId("hike-images-empty")).toBeNull();
    expect(screen.queryByTestId("hike-images")).toBeNull();
  });

  it("goes straight to the strip while the first upload is running", () => {
    show({ uploadingCount: 2 });

    expect(screen.queryByTestId("hike-images-empty")).toBeNull();
    expect(screen.getAllByTestId("hike-image-uploading")).toHaveLength(2);
  });
});

describe("with images", () => {
  it("shows one thumbnail per image, in the order given", () => {
    show({ list: images(3) });

    const sources = screen.UNSAFE_getAllByType(Image).map((image) => image.props.source.uri);
    expect(sources).toEqual([
      "https://media.stigvidd.se/hikes/0.jpg",
      "https://media.stigvidd.se/hikes/1.jpg",
      "https://media.stigvidd.se/hikes/2.jpg",
    ]);
  });

  it("rounds the thumbnails no more than the rest of the app", () => {
    show({ list: images(1) });

    const style = StyleSheet.flatten(screen.UNSAFE_getByType(Image).props.style);
    expect(style.borderRadius).toBe(BORDER_RADIUS);
  });

  it("opens the image that was tapped", () => {
    show({ list: images(3) });

    fireEvent.press(screen.getAllByTestId("hike-image-thumb")[2]);

    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it("tells the owner how many of the ten are used", () => {
    show({ list: images(6) });

    expect(screen.getByTestId("hike-images-count")).toHaveTextContent("6/10");
  });

  it("lets the owner add more from the header", () => {
    show({ list: images(6) });

    fireEvent.press(screen.getByTestId("hike-images-add"));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("hides the add button once the hike is full", () => {
    show({ list: images(10) });

    expect(screen.queryByTestId("hike-images-add")).toBeNull();
    expect(screen.getByTestId("hike-images-count")).toHaveTextContent("10/10");
  });

  it("counts running uploads towards the limit", () => {
    show({ list: images(8), uploadingCount: 2 });

    expect(screen.queryByTestId("hike-images-add")).toBeNull();
  });

  it("keeps the add button but disables it while an upload is running", () => {
    show({ list: images(3), uploadingCount: 1 });

    fireEvent.press(screen.getByTestId("hike-images-add"));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("puts running uploads at the end of the strip", () => {
    show({ list: images(2), uploadingCount: 1 });

    expect(screen.getAllByTestId("hike-image-thumb")).toHaveLength(2);
    expect(screen.getAllByTestId("hike-image-uploading")).toHaveLength(1);
  });

  it("shows a recipient the images without a count or an add button", () => {
    show({ list: images(3), canEdit: false });

    expect(screen.getAllByTestId("hike-image-thumb")).toHaveLength(3);
    expect(screen.queryByTestId("hike-images-count")).toBeNull();
    expect(screen.queryByTestId("hike-images-add")).toBeNull();
  });
});
