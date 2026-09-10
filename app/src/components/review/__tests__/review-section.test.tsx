// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ReviewSection from "@/components/review/review-section";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { Review } from "@/data/types";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import { StarRatingDisplay } from "react-native-star-rating-widget";

const mockDelete = jest.fn();
let mockIsDeleting = false;

jest.mock("@/hooks/review/useDeleteReview", () => ({
  useDeleteReview: () => ({ mutate: mockDelete, isPending: mockIsDeleting }),
}));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me" } }) };
});

// The grid opens a full-screen zoom viewer of its own; here only what it is handed matters.
jest.mock("@/components/review/review-image-grid", () => {
  const { Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({ reviewImages }: { reviewImages: { identifier: string }[] }) =>
      ReactActual.createElement(Text, { testID: "image-grid" }, reviewImages.map((i) => i.identifier).join(",")),
  };
});

const TRAIL_ID = "1c9a7e52-4d3b-4d1e-9c2a-6f8b0e7a3d55";

function review(overrides: Partial<Review> = {}): Review {
  return {
    identifier: "r1",
    rating: 4,
    trailReview: "Fin stig, lite blöt i mitten.",
    userName: "Alva",
    createdAt: "2026-05-01T10:00:00Z",
    userIdentifier: "someone-else",
    trailIdentifier: TRAIL_ID,
    ...overrides,
  };
}

function show(reviews: Review[], theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme) {
  return renderWithProviders(<ReviewSection reviews={reviews} />, { theme });
}

// Each review is collapsed until its row is pressed.
async function expand(title: string) {
  fireEvent.press(screen.getByText(title));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDeleting = false;
});

it("lists one row per review, under the name of whoever wrote it", () => {
  show([review({ identifier: "r1", userName: "Alva" }), review({ identifier: "r2", userName: "Bo" })]);

  expect(screen.getByText("Alva")).toBeTruthy();
  expect(screen.getByText("Bo")).toBeTruthy();
});

// userName is null once the author has deleted their account.
it("keeps a review whose author is gone, under a placeholder name", () => {
  show([review({ userName: null, userIdentifier: null })]);

  expect(screen.getByText("Borttagen användare")).toBeTruthy();
});

it("shows each review's own rating without opening it", () => {
  show([
    review({ identifier: "r1", userName: "Alva", rating: 4 }),
    review({ identifier: "r2", userName: "Bo", rating: 2 }),
  ]);

  const stars = screen.UNSAFE_getAllByType(StarRatingDisplay as never);
  expect(stars.map((s) => s.props.rating)).toEqual([4, 2]);
});

it("keeps the review text folded away until the row is opened", async () => {
  show([review()]);

  expect(screen.queryByText("Fin stig, lite blöt i mitten.")).toBeNull();

  await expand("Alva");

  expect(screen.getByText("Fin stig, lite blöt i mitten.")).toBeTruthy();
  expect(screen.getByText("2026-05-01")).toBeTruthy();
});

it("opens one review without opening the others", async () => {
  show([
    review({ identifier: "r1", userName: "Alva", trailReview: "Alvas text" }),
    review({ identifier: "r2", userName: "Bo", trailReview: "Bos text" }),
  ]);

  await expand("Alva");

  expect(screen.getByText("Alvas text")).toBeTruthy();
  expect(screen.queryByText("Bos text")).toBeNull();
});

it("shows the images belonging to the review", async () => {
  show([review({ reviewImages: [{ identifier: "i1", imageUrl: "https://media/1.jpg" }] })]);

  await expand("Alva");

  expect(screen.getByTestId("image-grid")).toHaveTextContent("i1");
});

it("draws no image grid for a review without pictures", async () => {
  show([review({ reviewImages: undefined })]);

  await expand("Alva");

  expect(screen.queryByTestId("image-grid")).toBeNull();
});

it("offers to report someone else's review, but not to delete it", async () => {
  show([review({ userIdentifier: "someone-else" })]);

  await expand("Alva");

  expect(screen.getByTestId("icon-alert-circle", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId("icon-trash-can-outline", { includeHiddenElements: true })).toBeNull();
});

it("offers to delete your own review, but not to report it", async () => {
  show([review({ userIdentifier: "me" })]);

  await expand("Alva");

  expect(screen.getByTestId("icon-trash-can-outline", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId("icon-alert-circle", { includeHiddenElements: true })).toBeNull();
});

// Neither action has anyone to act on once the author's account is gone.
it("offers neither action on a review whose author no longer exists", async () => {
  show([review({ userName: null, userIdentifier: null })]);

  await expand("Borttagen användare");

  expect(screen.queryByTestId("icon-alert-circle", { includeHiddenElements: true })).toBeNull();
  expect(screen.queryByTestId("icon-trash-can-outline", { includeHiddenElements: true })).toBeNull();
});

it("acknowledges a report", async () => {
  const { store } = show([review({ userIdentifier: "someone-else" })]);

  await expand("Alva");
  fireEvent.press(screen.getByTestId("icon-alert-circle", { includeHiddenElements: true }));
  await settle();

  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success" });
});

it("asks before deleting, and deletes nothing until the answer comes back", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  show([review({ userIdentifier: "me" })]);

  await expand("Alva");
  fireEvent.press(screen.getByTestId("icon-trash-can-outline", { includeHiddenElements: true }));
  await settle();

  expect(alert).toHaveBeenCalledWith("Ta bort recension", "Är du säker på att du vill ta bort din recension?", [
    expect.objectContaining({ text: "Avbryt", style: "cancel" }),
    expect.objectContaining({ text: "Ta bort", style: "destructive" }),
  ]);
  expect(mockDelete).not.toHaveBeenCalled();
  alert.mockRestore();
});

it("deletes this review from this trail once confirmed", async () => {
  let buttons: { text?: string; onPress?: () => void }[] = [];
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, b) => {
    buttons = (b ?? []) as typeof buttons;
  });
  show([review({ identifier: "r9", userIdentifier: "me" })]);

  await expand("Alva");
  fireEvent.press(screen.getByTestId("icon-trash-can-outline", { includeHiddenElements: true }));
  await settle();
  buttons.find((button) => button.text === "Ta bort")?.onPress?.();

  expect(mockDelete).toHaveBeenCalledWith({ reviewIdentifier: "r9", trailIdentifier: TRAIL_ID });
  alert.mockRestore();
});

it("deletes nothing when the confirmation is cancelled", async () => {
  let buttons: { text?: string; onPress?: () => void }[] = [];
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, b) => {
    buttons = (b ?? []) as typeof buttons;
  });
  show([review({ userIdentifier: "me" })]);

  await expand("Alva");
  fireEvent.press(screen.getByTestId("icon-trash-can-outline", { includeHiddenElements: true }));
  await settle();
  buttons.find((button) => button.text === "Avbryt")?.onPress?.();

  expect(mockDelete).not.toHaveBeenCalled();
  alert.mockRestore();
});

// A second press while the first delete is in flight would send it twice.
it("greys the delete out while the delete is in flight", async () => {
  mockIsDeleting = true;
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  show([review({ userIdentifier: "me" })]);

  await expand("Alva");
  const icon = screen.getByTestId("icon-trash-can-outline", { includeHiddenElements: true });
  fireEvent.press(icon);
  await settle();

  expect(icon.props.color).toBe(AppDefaultTheme.colors.surfaceDisabled);
  expect(alert).not.toHaveBeenCalled();
  alert.mockRestore();
});

it("draws every row on the theme's surface colour", () => {
  show([review()]);

  expect(screen.getByText("Alva")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.surface });
});

it("draws the rows on the dark theme's surface colour too", () => {
  show([review()], AppDarkTheme);

  expect(screen.getByText("Alva")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.surface });
});
