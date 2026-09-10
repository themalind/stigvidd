// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AddReviewForm from "@/components/review/add/add-review-form";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";
import StarRating from "react-native-star-rating-widget";

const mockMutate = jest.fn();
let mockIsPending = false;

jest.mock("@/hooks/review/useCreateReview", () => ({
  useCreateReview: () => ({ mutate: mockMutate, isPending: mockIsPending }),
}));

// The picker is a native dialog; the form's own job is to carry whatever it returns.
jest.mock("@/components/review/add/add-review-images", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({ setReviewImages }: { setReviewImages: (uris: string[]) => void }) =>
      ReactActual.createElement(
        Pressable,
        { onPress: () => setReviewImages(["file:///bild-1.jpg", "file:///bild-2.jpg"]) },
        ReactActual.createElement(Text, null, "pick-images"),
      ),
  };
});

const TRAIL_ID = "3f7c1f0e-9d1a-4f3b-8f2e-6d9a2b7c1e44";
const onSuccess = jest.fn();

function show() {
  return renderWithProviders(<AddReviewForm trailIdentifier={TRAIL_ID} onSuccess={onSuccess} />);
}

// react-hook-form's field.onChange returns a Promise, so a synchronous act() drops the update;
// see docs/notes/app-component-testing-what-layout-can-be-asserted.md.
async function setRating(stars: number) {
  const widget = screen.UNSAFE_getByType(StarRating as never);
  await act(async () => {
    widget.props.onChange(stars);
  });
}

function currentRating() {
  return screen.UNSAFE_getByType(StarRating as never).props.rating;
}

function writeReview(text: string) {
  fireEvent.changeText(screen.getByTestId("review-text"), text);
}

async function submit() {
  fireEvent.press(screen.getByText("Spara"));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsPending = false;
});

it("sends the review, its rating and the trail it belongs to", async () => {
  show();

  await setRating(4);
  writeReview("Fin stig, lite blöt i mitten.");
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
  show();

  await setRating(5);
  await submit();

  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ review: "", rating: 5 }));
});

it("carries the images the picker handed back", async () => {
  show();

  fireEvent.press(screen.getByText("pick-images"));
  await setRating(3);
  await submit();

  expect(mockMutate).toHaveBeenCalledWith(
    expect.objectContaining({ imageUris: ["file:///bild-1.jpg", "file:///bild-2.jpg"] }),
  );
});

// The field caps typing at 500; the rule is what stops pasted text or a changed cap reaching the API.
it("refuses a review longer than the column it is stored in", async () => {
  show();

  await setRating(3);
  writeReview("x".repeat(501));
  await submit();

  expect(screen.getByText("Recensionen är för lång. Max 500 tecken")).toBeTruthy();
  expect(mockMutate).not.toHaveBeenCalled();
});

it("says it is working, and takes no second submit while it is", async () => {
  mockIsPending = true;
  show();

  expect(screen.getByText("Sparar...")).toBeTruthy();
  fireEvent.press(screen.getByText("Sparar..."));
  await settle();

  expect(mockMutate).not.toHaveBeenCalled();
});

// Three separate help dialogs share one screen; opening one must not open the others.
it("opens each help dialog on its own", async () => {
  show();

  const helpButtons = screen.getAllByTestId("icon-information-slab-circle-outline");
  expect(helpButtons).toHaveLength(3);

  fireEvent.press(helpButtons[0]);
  expect(screen.getByText("Sätt ett betyg ⭐️⭐️")).toBeTruthy();
  expect(screen.queryByText("Lägg till bilder")).toBeNull();
  expect(screen.queryByText("Skriv något")).toBeNull();
});

// The form opens on no stars, so the required-rating rule is reachable and nothing is sent as a 1 by default.
it("opens with no stars filled in", () => {
  show();

  expect(currentRating()).toBe(0);
});

it("refuses a review with no rating, and sends nothing", async () => {
  show();

  writeReview("Fin stig, lite blöt i mitten.");
  await submit();

  expect(screen.getByText("Sätt ett betyg")).toBeTruthy();
  expect(mockMutate).not.toHaveBeenCalled();
});

it("sends the review once a rating has been picked", async () => {
  show();

  writeReview("Fin stig, lite blöt i mitten.");
  await submit();
  await setRating(2);
  await submit();

  expect(screen.queryByText("Sätt ett betyg")).toBeNull();
  expect(mockMutate).toHaveBeenCalledTimes(1);
  expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ rating: 2 }));
});

// The widget rates in half stars, and CreateReviewRequestValidator requires rating >= 1.
it("only lets whole stars be picked, which is what the API accepts", () => {
  show();

  expect(screen.UNSAFE_getByType(StarRating as never).props.step).toBe("full");
});

it("refuses a rating below one star", async () => {
  show();

  await setRating(0.5);
  await submit();

  expect(screen.getByText("Sätt ett betyg")).toBeTruthy();
  expect(mockMutate).not.toHaveBeenCalled();
});
