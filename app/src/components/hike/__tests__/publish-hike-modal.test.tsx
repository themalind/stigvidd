// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import PublishHikeModal, { lengthOfPath, PUBLISH_CONSENT_VERSION } from "@/components/hike/publish-hike-modal";
import { Hike } from "@/data/types";
import { HIKE_SUBMISSIONS_QUERY_ROOT } from "@/hooks/hike/useMyHikeSubmissions";
import en from "@/i18n/locales/en.json";
import sv from "@/i18n/locales/sv.json";
import { flushUntil, settle } from "@/test/flush";
import { captureKeyboard } from "@/test/keyboard";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";

const mockCreateSubmission = jest.fn();
jest.mock("@/api/hike-submissions", () => ({
  createHikeSubmission: (...args: unknown[]) => mockCreateSubmission(...args),
}));

const onDismiss = jest.fn();

function hike(overrides: Partial<Hike> = {}): Hike {
  return {
    identifier: "hike-1",
    name: "Kvällsrunda",
    hikeLength: 1,
    duration: 1000,
    createdBy: "me",
    createdAt: "2026-05-04T18:00:00Z",
    coordinates: JSON.stringify([
      { latitude: 57.72, longitude: 12.94 },
      { latitude: 57.721, longitude: 12.941 },
      { latitude: 57.722, longitude: 12.942 },
    ]),
    gettingThere: "Buss 3",
    description: "Runt sjön",
    images: [
      { identifier: "img-1", imageUrl: "https://media/1.jpeg" },
      { identifier: "img-2", imageUrl: "https://media/2.jpeg" },
    ],
    ...overrides,
  };
}

async function open(overrides: Partial<Hike> = {}, city = "Borås") {
  const rendered = renderWithProviders(
    <PublishHikeModal hike={hike(overrides)} nickName="Vandrarvennen" onDismiss={onDismiss} />,
  );
  await flushUntil(() => screen.queryByTestId("publish-submit"));
  fireEvent.changeText(screen.getByTestId("publish-city"), city);
  return rendered;
}

function isDisabled(testID: string) {
  return screen.getByTestId(testID).props.accessibilityState?.disabled === true;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateSubmission.mockResolvedValue({ identifier: "s1" });
});

it("keeps the submit button disabled until the transfer is accepted", async () => {
  await open();

  expect(isDisabled("publish-submit")).toBe(true);

  fireEvent.press(screen.getByTestId("publish-consent"));

  expect(isDisabled("publish-submit")).toBe(false);
});

it("requires a difficulty before sending", async () => {
  await open();
  fireEvent.press(screen.getByTestId("publish-consent"));

  fireEvent.press(screen.getByTestId("publish-submit"));
  await settle();

  expect(mockCreateSubmission).not.toHaveBeenCalled();
  expect(screen.getByText("Välj svårighetsgrad")).toBeTruthy();
});

it("requires a description and how to get there, but not parking", async () => {
  await open({ description: undefined, gettingThere: undefined });
  fireEvent.press(screen.getByTestId("publish-consent"));
  fireEvent.press(screen.getByTestId("publish-difficulty-2"));

  fireEvent.press(screen.getByTestId("publish-submit"));
  await settle();

  expect(mockCreateSubmission).not.toHaveBeenCalled();
  expect(screen.getByText("Beskriv leden")).toBeTruthy();
  expect(screen.getByText("Berätta hur man tar sig dit")).toBeTruthy();
});

it("sends the untrimmed walk with all photos, the nickname choice and the consent", async () => {
  const { store } = await open();
  fireEvent.press(screen.getByTestId("publish-difficulty-2"));
  fireEvent.press(screen.getByTestId("publish-consent"));

  fireEvent.press(screen.getByTestId("publish-submit"));
  await flushUntil(() => mockCreateSubmission.mock.calls.length > 0);
  await settle();

  expect(mockCreateSubmission).toHaveBeenCalledWith({
    hikeIdentifier: "hike-1",
    name: "Kvällsrunda",
    description: "Runt sjön",
    classification: 2,
    gettingThere: "Buss 3",
    parking: null,
    publicTransport: null,
    accessibilityInfo: null,
    city: "Borås",
    showSubmitterName: true,
    acceptTransfer: true,
    consentVersion: PUBLISH_CONSENT_VERSION,
    consentLocale: "sv",
    trimStartIndex: null,
    trimEndIndex: null,
    imageIdentifiers: ["img-1", "img-2"],
  });
  expect(onDismiss).toHaveBeenCalled();
  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success" });
});

it("requires a city, since every trail is listed under one", async () => {
  await open({}, "   ");
  fireEvent.press(screen.getByTestId("publish-consent"));
  fireEvent.press(screen.getByTestId("publish-difficulty-2"));

  fireEvent.press(screen.getByTestId("publish-submit"));
  await settle();

  expect(mockCreateSubmission).not.toHaveBeenCalled();
  expect(screen.getByText("Ange stad eller ort")).toBeTruthy();
});

it("sends the city trimmed", async () => {
  await open({}, "  Ulricehamn ");
  fireEvent.press(screen.getByTestId("publish-difficulty-2"));
  fireEvent.press(screen.getByTestId("publish-consent"));

  fireEvent.press(screen.getByTestId("publish-submit"));
  await flushUntil(() => mockCreateSubmission.mock.calls.length > 0);

  expect(mockCreateSubmission).toHaveBeenCalledWith(expect.objectContaining({ city: "Ulricehamn" }));
});

it("sends the variation, trimmed", async () => {
  await open();
  fireEvent.press(screen.getByTestId("publish-difficulty-2"));
  fireEvent.press(screen.getByTestId("publish-consent"));
  fireEvent.changeText(screen.getByTestId("publish-accessibilityInfo"), "  Grus och rötter  ");

  fireEvent.press(screen.getByTestId("publish-submit"));
  await flushUntil(() => mockCreateSubmission.mock.calls.length > 0);

  expect(mockCreateSubmission).toHaveBeenCalledWith(expect.objectContaining({ accessibilityInfo: "Grus och rötter" }));
});

it("leaves out deselected photos and the nickname when unticked", async () => {
  await open();
  fireEvent.press(screen.getByTestId("publish-image-img-1"));
  fireEvent.press(screen.getByTestId("publish-show-name"));
  fireEvent.press(screen.getByTestId("publish-difficulty-1"));
  fireEvent.press(screen.getByTestId("publish-consent"));

  fireEvent.press(screen.getByTestId("publish-submit"));
  await flushUntil(() => mockCreateSubmission.mock.calls.length > 0);

  expect(mockCreateSubmission).toHaveBeenCalledWith(
    expect.objectContaining({ imageIdentifiers: ["img-2"], showSubmitterName: false, classification: 1 }),
  );
});

it("says the walk is already sent in or published when the server answers 409, and reads the submissions again", async () => {
  mockCreateSubmission.mockRejectedValue(new ApiError("conflict", 409));
  const { store, queryClient } = await open();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  fireEvent.press(screen.getByTestId("publish-difficulty-3"));
  fireEvent.press(screen.getByTestId("publish-consent"));

  fireEvent.press(screen.getByTestId("publish-submit"));
  await flushUntil(() => store.get(snackbarAtom).visible);

  expect(store.get(snackbarAtom)).toMatchObject({
    type: "error",
    message: "Promenaden är redan inskickad eller publicerad.",
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: [HIKE_SUBMISSIONS_QUERY_ROOT] });
  expect(onDismiss).not.toHaveBeenCalled();
});

it("says the limit is reached when the server answers 429", async () => {
  mockCreateSubmission.mockRejectedValue(new ApiError("too many", 429));
  const { store } = await open();
  fireEvent.press(screen.getByTestId("publish-difficulty-3"));
  fireEvent.press(screen.getByTestId("publish-consent"));

  fireEvent.press(screen.getByTestId("publish-submit"));
  await flushUntil(() => store.get(snackbarAtom).visible);

  expect(store.get(snackbarAtom)).toMatchObject({
    type: "error",
    message: "Du har redan 3 promenader som väntar på granskning. Du kan publicera fler när de är granskade.",
  });
});

it("tells a walk without photos that example images are used", async () => {
  await open({ images: [] });

  expect(screen.getByText("Promenaden har inga bilder, så vi lägger in exempelbilder tills vidare.")).toBeTruthy();
});

it("opens the difficulty guide from the info icon", async () => {
  await open();

  fireEvent.press(screen.getByTestId("publish-difficulty-help"));
  await flushUntil(() => screen.queryByTestId("difficulty-info-content"));

  expect(screen.getByTestId("difficulty-info-content")).toBeTruthy();
});

it("measures a path in metres", () => {
  const metres = lengthOfPath([
    [12.94, 57.72],
    [12.94, 57.729],
  ]);

  expect(metres).toBeGreaterThan(990);
  expect(metres).toBeLessThan(1010);
});

// keep-comment: the server stores its own copy of this wording per version, so a text change without a version bump would record the wrong consent
it("keeps the consent wording the server stores for this version", () => {
  expect(PUBLISH_CONSENT_VERSION).toBe("2026-10-19");
  expect(`${sv.publish.consent} ${sv.publish.consentNote}`).toBe(
    "Jag ger Stigvidd rätt att publicera den här promenaden som en led. Stigvidd får för alltid och utan ersättning använda, ändra och publicera text, linje och valda bilder. Rätten går inte att återkalla efter att leden publicerats. Du behåller upphovsrätten till dina bilder och kan fortfarande ta bort din egen promenad.",
  );
  expect(`${en.publish.consent} ${en.publish.consentNote}`).toBe(
    "I give Stigvidd the right to publish this walk as a trail. Stigvidd may use, edit and publish the text, route and chosen photos, forever and free of charge. This right cannot be withdrawn once the trail is published. You keep the copyright to your photos and can still delete your own walk.",
  );
});

it("caps the card's height with no keyboard up, so the form scrolls instead of outgrowing the screen", async () => {
  await open();

  const { maxHeight } = StyleSheet.flatten(screen.getByTestId("publish-card").props.style);
  expect(maxHeight).toBe(Dimensions.get("window").height * 0.9);
});

it("renders the map as a TextureView on Android, so it moves with the card when the keyboard lifts it", async () => {
  await open();

  expect(screen.getByTestId("maplibre-Map").props.androidView).toBe("texture");
});

it("lifts and shrinks the card above the iOS keyboard so the submit button stays reachable", async () => {
  const keyboard = captureKeyboard();
  await open();

  keyboard.show(300);

  expect(screen.getByTestId("modal-wrapper")).toHaveStyle({ marginBottom: 310 });
  const { maxHeight } = StyleSheet.flatten(screen.getByTestId("publish-card").props.style);
  expect(maxHeight).toBeLessThanOrEqual(Dimensions.get("window").height - 310 - 10);

  keyboard.hide();

  expect(screen.getByTestId("modal-wrapper")).not.toHaveStyle({ marginBottom: 310 });
});
