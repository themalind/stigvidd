// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ImageStrip from "@/components/media/image-strip";
import { ViewerImage } from "@/components/media/image-viewer";
import { BORDER_RADIUS } from "@/constants/constants";
import { getAllByType, getByType } from "@/test/composites";
import { defined } from "@/test/defined";
import { flushUntilGone, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Image } from "expo-image";
import { ScrollView, StyleSheet } from "react-native";
import { Surface } from "react-native-paper";

const onAdd = jest.fn();
const onRemove = jest.fn();
const onReport = jest.fn();

function images(count: number): ViewerImage[] {
  return Array.from({ length: count }, (_, i) => ({
    identifier: `img-${i}`,
    imageUrl: `https://media.stigvidd.se/hikes/${i}.jpg`,
  }));
}

function show({ list = images(0), canEdit = true, uploadingCount = 0, withTitle = true } = {}) {
  return renderWithProviders(
    <ImageStrip
      images={list}
      title={withTitle ? "Bilder" : undefined}
      edit={canEdit ? { max: 10, emptyHint: "Upp till 10 bilder", uploadingCount, onAdd, onRemove } : undefined}
    />,
  );
}

function thumbSources() {
  return getAllByType(Image)
    .filter((image) => StyleSheet.flatten(image.props.style).aspectRatio === 3 / 4)
    .map((image) => image.props.source.uri);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("without images", () => {
  it("invites the owner to add some, with the caller's hint", async () => {
    await show();

    const empty = screen.getByTestId("image-strip-empty");
    expect(screen.getByText("Lägg till bilder")).toBeTruthy();
    expect(screen.getByText("Upp till 10 bilder")).toBeTruthy();

    await fireEvent.press(empty);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("draws the invitation dashed, not as a filled card", async () => {
    await show();

    const style = StyleSheet.flatten(screen.getByTestId("image-strip-empty").props.style);
    expect(style.borderStyle).toBe("dashed");
  });

  it("shows nothing at all to someone who may not edit", async () => {
    await show({ canEdit: false });

    expect(screen.queryByTestId("image-strip-empty")).toBeNull();
    expect(screen.queryByTestId("image-strip")).toBeNull();
  });

  it("goes straight to the strip while the first upload is running", async () => {
    await show({ uploadingCount: 2 });

    expect(screen.queryByTestId("image-strip-empty")).toBeNull();
    expect(screen.getAllByTestId("image-strip-uploading")).toHaveLength(2);
  });
});

describe("with images", () => {
  it("shows one thumbnail per image, in the order given", async () => {
    await show({ list: images(3) });

    expect(thumbSources()).toEqual([
      "https://media.stigvidd.se/hikes/0.jpg",
      "https://media.stigvidd.se/hikes/1.jpg",
      "https://media.stigvidd.se/hikes/2.jpg",
    ]);
  });

  it("rounds the thumbnails no more than the rest of the app", async () => {
    await show({ list: images(1) });

    const image = defined(getAllByType(Image)[0], "thumbnail");
    expect(StyleSheet.flatten(image.props.style).borderRadius).toBe(BORDER_RADIUS);
  });

  it("opens the tapped image full screen", async () => {
    await show({ list: images(3) });

    await fireEvent.press(defined(screen.getAllByTestId("image-strip-thumb")[2], "third thumb"));
    await settle();

    expect(screen.getByTestId("image-viewer-list").props.initialScrollIndex).toBe(2);
  });

  it("shows the caller's title", async () => {
    await show({ list: images(1) });

    expect(screen.getByText("Bilder")).toBeTruthy();
  });

  it("leaves the title out when the caller has its own heading", async () => {
    await show({ list: images(1), withTitle: false });

    expect(screen.queryByText("Bilder")).toBeNull();
    expect(screen.getByTestId("image-strip-count")).toHaveTextContent("1/10");
  });

  it("tells the owner how many of the limit are used", async () => {
    await show({ list: images(6) });

    expect(screen.getByTestId("image-strip-count")).toHaveTextContent("6/10");
  });

  it("lets the owner add more from the header", async () => {
    await show({ list: images(6) });

    await fireEvent.press(screen.getByTestId("image-strip-add"));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("hides the add button once the limit is reached", async () => {
    await show({ list: images(10) });

    expect(screen.queryByTestId("image-strip-add")).toBeNull();
    expect(screen.getByTestId("image-strip-count")).toHaveTextContent("10/10");
  });

  it("counts running uploads towards the limit", async () => {
    await show({ list: images(8), uploadingCount: 2 });

    expect(screen.queryByTestId("image-strip-add")).toBeNull();
  });

  it("keeps the add button but disables it while an upload is running", async () => {
    await show({ list: images(3), uploadingCount: 1 });

    await fireEvent.press(screen.getByTestId("image-strip-add"));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("puts running uploads at the end of the strip", async () => {
    await show({ list: images(2), uploadingCount: 1 });

    expect(screen.getAllByTestId("image-strip-thumb")).toHaveLength(2);
    expect(screen.getAllByTestId("image-strip-uploading")).toHaveLength(1);
  });

  it("shows a viewer the images without a count, an add button or crosses", async () => {
    await show({ list: images(3), canEdit: false });

    expect(screen.getAllByTestId("image-strip-thumb")).toHaveLength(3);
    expect(screen.queryByTestId("image-strip-count")).toBeNull();
    expect(screen.queryByTestId("image-strip-add")).toBeNull();
    expect(screen.queryByTestId("image-strip-remove")).toBeNull();
  });
});

describe("removing", () => {
  it("gives every thumbnail a cross of its own", async () => {
    await show({ list: images(3) });

    expect(screen.getAllByTestId("image-strip-remove")).toHaveLength(3);
  });

  it("hands back the image of the pressed cross, without opening it", async () => {
    await show({ list: images(3) });

    await fireEvent.press(defined(screen.getAllByTestId("image-strip-remove")[1], "second cross"));
    await settle();

    expect(onRemove).toHaveBeenCalledWith(images(3)[1]);
    expect(screen.queryByTestId("image-viewer-list")).toBeNull();
  });

  it("puts the cross in the top corner as a square with the app's radius", async () => {
    await show({ list: images(1) });

    expect(screen.getByTestId("image-strip-remove")).toHaveStyle({
      position: "absolute",
      top: 4,
      right: 4,
      borderRadius: BORDER_RADIUS,
    });
  });

  it("names the image the cross removes", async () => {
    await show({ list: images(2) });

    expect(screen.getByLabelText("Ta bort bild 2 av 2")).toBeTruthy();
  });
});

describe("inside another card", () => {
  it("drops the card's own padding and header", async () => {
    await renderWithProviders(<ImageStrip images={images(2)} variant="plain" />);

    expect(StyleSheet.flatten(getByType(Surface).props.style).paddingVertical).toBeUndefined();
    expect(screen.queryByTestId("image-strip-count")).toBeNull();
    expect(screen.getAllByTestId("image-strip-thumb")).toHaveLength(2);
  });

  it("spans the width of the card it sits in", async () => {
    await renderWithProviders(<ImageStrip images={images(2)} variant="plain" />);

    expect(StyleSheet.flatten(getByType(Surface).props.style).alignSelf).toBe("stretch");
  });
});

describe("height", () => {
  it("keeps the strip as tall as its thumbnails instead of filling its parent", async () => {
    await show({ list: images(2) });

    expect(StyleSheet.flatten(getByType(ScrollView).props.style).flexGrow).toBe(0);
  });
});

describe("reporting", () => {
  it("closes the viewer and hands over the image on screen", async () => {
    await renderWithProviders(<ImageStrip images={images(2)} onReport={onReport} />);

    await fireEvent.press(defined(screen.getAllByTestId("image-strip-thumb")[1], "second thumb"));
    await settle();
    await fireEvent.press(screen.getByTestId("image-viewer-report"));
    await flushUntilGone(() => screen.queryByTestId("image-viewer-list"));

    expect(onReport).toHaveBeenCalledWith(images(2)[1]);
    expect(screen.queryByTestId("image-viewer-list")).toBeNull();
  });

  it("offers no report flag when the caller did not ask for one", async () => {
    await renderWithProviders(<ImageStrip images={images(2)} />);

    await fireEvent.press(defined(screen.getAllByTestId("image-strip-thumb")[0], "first thumb"));
    await settle();

    expect(screen.queryByTestId("image-viewer-report")).toBeNull();
  });
});
