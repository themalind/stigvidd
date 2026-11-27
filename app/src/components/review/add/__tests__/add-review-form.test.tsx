// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AddReviewForm from "@/components/review/add/add-review-form";
import type { ReviewFormImage } from "@/components/review/add/add-review-images";
import { Review } from "@/data/types";
import { getByType } from "@/test/composites";
import { settle } from "@/test/flush";
import { defined } from "@/test/defined";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";
import StarRating from "react-native-star-rating-widget";

const mockMutate = jest.fn();
const mockUpdate = jest.fn();
let mockIsPending = false;

jest.mock("@/hooks/review/useCreateReview", () => ({
  useCreateReview: () => ({ mutate: mockMutate, isPending: mockIsPending }),
}));

jest.mock("@/hooks/review/useUpdateReview", () => ({
  useUpdateReview: () => ({ mutate: mockUpdate, isPending: false }),
}));

const mockDelete = jest.fn();
jest.mock("@/hooks/review/useDeleteReview", () => ({
  useDeleteReview: (onDeleted?: () => void) => ({
    mutate: (variables: unknown) => {
      mockDelete(variables);
      onDeleted?.();
    },
    isPending: false,
  }),
}));

// The picker is a native dialog; the form's own job is to carry whatever it returns.
jest.mock("@/components/review/add/add-review-images", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({ images, onChange }: { images: ReviewFormImage[]; onChange: (images: ReviewFormImage[]) => void }) =>
      ReactActual.createElement(
        View,
        null,
        ReactActual.createElement(
          Pressable,
          {
            onPress: () =>
              onChange([
                ...images,
                { kind: "new", localId: 0, uri: "file:///bild-1.jpg" },
                { kind: "new", localId: 1, uri: "file:///bild-2.jpg" },
              ]),
          },
          ReactActual.createElement(Text, null, "pick-images"),
        ),
        ReactActual.createElement(
          Pressable,
          { onPress: () => onChange(images.slice(1)) },
          ReactActual.createElement(Text, null, "drop-first-image"),
        ),
        ReactActual.createElement(Text, null, `holding ${images.map((image) => image.uri).join(",")}`),
      ),
  };
});

const TRAIL_ID = "3f7c1f0e-9d1a-4f3b-8f2e-6d9a2b7c1e44";
const onSuccess = jest.fn();

const STORED_REVIEW: Review = {
  identifier: "r1",
  trailReview: "Fin led",
  rating: 4,
  userName: "Vandraren",
  createdAt: "2026-10-01T10:00:00Z",
  userIdentifier: "u1",
  trailIdentifier: TRAIL_ID,
  reviewImages: [
    { identifier: "img-1", imageUrl: "https://media.stigvidd.se/reviews/1.jpg" },
    { identifier: "img-2", imageUrl: "https://media.stigvidd.se/reviews/2.jpg" },
  ],
};

function show() {
  return renderWithProviders(<AddReviewForm trailIdentifier={TRAIL_ID} onSuccess={onSuccess} />);
}

function showEditing(review: Review = STORED_REVIEW) {
  return renderWithProviders(<AddReviewForm trailIdentifier={TRAIL_ID} review={review} onSuccess={onSuccess} />);
}

// react-hook-form's field.onChange returns a Promise, so a synchronous act() drops the update;
// see docs/notes/app-component-testing-what-layout-can-be-asserted.md.
async function setRating(stars: number) {
  const widget = getByType(StarRating);
  await act(async () => {
    widget.props.onChange(stars);
  });
}

function currentRating() {
  return getByType(StarRating).props.rating;
}

async function writeReview(text: string) {
  await fireEvent.changeText(screen.getByTestId("review-text"), text);
}

async function submit() {
  await fireEvent.press(screen.getByText("Spara"));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsPending = false;
});

it("sends the review, its rating and the trail it belongs to", async () => {
  await show();

  await setRating(4);
  await writeReview("Fin stig, lite blöt i mitten.");
  await submit();

  expect(mockMutate).toHaveBeenCalledWith({
    trailIdentifier: TRAIL_ID,
    review: "Fin stig, lite blöt i mitten.",
    rating: 4,
    imageUris: [],
  });
});

// The text is optional: a rating on its own is a review.
it("sends an empty review rather than nothing at all", async () => {
  await show();

  await setRating(5);
  await submit();

  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ review: "", rating: 5 }));
});

it("carries the images the picker handed back", async () => {
  await show();

  await fireEvent.press(screen.getByText("pick-images"));
  await setRating(3);
  await submit();

  expect(mockMutate).toHaveBeenCalledWith(
    expect.objectContaining({ imageUris: ["file:///bild-1.jpg", "file:///bild-2.jpg"] }),
  );
});

// The field caps typing at 500; the rule is what stops pasted text or a changed cap reaching the API.
it("refuses a review longer than the column it is stored in", async () => {
  await show();

  await setRating(3);
  await writeReview("x".repeat(501));
  await submit();

  expect(screen.getByText("Recensionen är för lång. Max 500 tecken")).toBeTruthy();
  expect(mockMutate).not.toHaveBeenCalled();
});

it("says it is working, and takes no second submit while it is", async () => {
  mockIsPending = true;
  await show();

  expect(screen.getByText("Sparar...")).toBeTruthy();
  await fireEvent.press(screen.getByText("Sparar..."));
  await settle();

  expect(mockMutate).not.toHaveBeenCalled();
});

// Three separate help dialogs share one screen; opening one must not open the others.
it("opens each help dialog on its own", async () => {
  await show();

  const helpButtons = [
    screen.getByLabelText("Sätt ett betyg ⭐️⭐️"),
    screen.getByLabelText("Lägg till bilder"),
    screen.getByLabelText("Skriv något"),
  ];
  expect(helpButtons).toHaveLength(3);

  await fireEvent.press(defined(helpButtons[0], "first help button"));
  expect(screen.getByText("Sätt ett betyg ⭐️⭐️")).toBeTruthy();
  expect(screen.queryByText("Lägg till bilder")).toBeNull();
  expect(screen.queryByText("Skriv något")).toBeNull();
});

// The form opens on no stars, so the required-rating rule is reachable and nothing is sent as a 1 by default.
it("opens with no stars filled in", async () => {
  await show();

  expect(currentRating()).toBe(0);
});

it("refuses a review with no rating, and sends nothing", async () => {
  await show();

  await writeReview("Fin stig, lite blöt i mitten.");
  await submit();

  expect(screen.getByText("Sätt ett betyg")).toBeTruthy();
  expect(mockMutate).not.toHaveBeenCalled();
});

it("sends the review once a rating has been picked", async () => {
  await show();

  await writeReview("Fin stig, lite blöt i mitten.");
  await submit();
  await setRating(2);
  await submit();

  expect(screen.queryByText("Sätt ett betyg")).toBeNull();
  expect(mockMutate).toHaveBeenCalledTimes(1);
  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ rating: 2 }));
});

// The widget rates in half stars, and CreateReviewRequestValidator requires rating >= 1.
it("only lets whole stars be picked, which is what the API accepts", async () => {
  await show();

  expect(getByType(StarRating).props.step).toBe("full");
});

it("sends five stars when the drag overshoots the last star", async () => {
  await show();

  await setRating(7);
  await submit();

  expect(screen.queryByText("Sätt ett betyg")).toBeNull();
  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ rating: 5 }));
});

it("refuses a rating below one star", async () => {
  await show();

  await setRating(0.5);
  await submit();

  expect(screen.getByText("Sätt ett betyg")).toBeTruthy();
  expect(mockMutate).not.toHaveBeenCalled();
});

describe("editing a review", () => {
  it("opens on the stored rating, text and images", async () => {
    await showEditing();

    expect(currentRating()).toBe(4);
    expect(screen.getByTestId("review-text").props.value).toBe("Fin led");
    expect(
      screen.getByText("holding https://media.stigvidd.se/reviews/1.jpg,https://media.stigvidd.se/reviews/2.jpg"),
    ).toBeTruthy();
  });

  it("saves the changes over the review instead of creating a new one", async () => {
    await showEditing();

    await setRating(2);
    await writeReview("Blöt efter regnet");
    await submit();

    expect(mockUpdate).toHaveBeenCalledWith({
      reviewIdentifier: "r1",
      review: "Blöt efter regnet",
      rating: 2,
      removedImageIdentifiers: [],
      newImageUris: [],
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("sends the stored images taken out, by identifier", async () => {
    await showEditing();

    await fireEvent.press(screen.getByText("drop-first-image"));
    await submit();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ removedImageIdentifiers: ["img-1"], newImageUris: [] }),
    );
  });

  it("uploads only the newly picked images, not the stored ones", async () => {
    await showEditing();

    await fireEvent.press(screen.getByText("pick-images"));
    await submit();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        removedImageIdentifiers: [],
        newImageUris: ["file:///bild-1.jpg", "file:///bild-2.jpg"],
      }),
    );
  });

  it("sends an empty text when the text is cleared", async () => {
    await showEditing();

    await writeReview("");
    await submit();

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ review: "" }));
  });

  it("opens a review without text or images on an empty field", async () => {
    await showEditing({ ...STORED_REVIEW, trailReview: undefined, reviewImages: undefined });

    expect(screen.getByTestId("review-text").props.value).toBeUndefined();
    expect(screen.getByText("holding")).toBeTruthy();
  });

  it("deletes the review once the user confirms, and closes the form", async () => {
    await showEditing();

    await fireEvent.press(screen.getByTestId("delete-own-review"));
    await settle();
    await fireEvent.press(screen.getByTestId("review-delete-dialog-confirm"));
    await settle();

    expect(mockDelete).toHaveBeenCalledWith({ reviewIdentifier: "r1", trailIdentifier: TRAIL_ID });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("keeps the review when the user cancels the delete", async () => {
    await showEditing();

    await fireEvent.press(screen.getByTestId("delete-own-review"));
    await settle();
    await fireEvent.press(screen.getByTestId("review-delete-dialog-cancel"));
    await settle();

    expect(mockDelete).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

it("offers no delete on a review that does not exist yet", async () => {
  await show();

  expect(screen.queryByTestId("delete-own-review")).toBeNull();
});
