// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AboutScreen from "@/components/about/about-screen";
import { PRIVACY_POLICY_URL, SCREEN_PADDING, SOURCE_CODE_URL, TERMS_OF_USE_URL } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: (...args: unknown[]) => mockBack(...args) },
}));

// The version comes from app.json at build time, read through a getter so a test can take it away.
let mockVersion: string | undefined = "1.4.2";
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { version: mockVersion };
    },
  },
}));

const EMAIL = "info@lingonberg.se";
const SOURCE_LINK = "Visa källkoden på GitHub";

function show(theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme) {
  return renderWithProviders(<AboutScreen />, { theme });
}

async function press(label: string) {
  fireEvent.press(screen.getByText(label));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVersion = "1.4.2";
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("says what the app is for", () => {
  show();

  expect(screen.getByText("Stigvidd")).toBeTruthy();
  expect(screen.getByText("Upptäck leder nära dig")).toBeTruthy();
  expect(screen.getByText(/vandringsapp skapad som ett hobbyprojekt/)).toBeTruthy();
});

// t("about.features") is an array; a missing key returns the key itself and empties the list, so the count is asserted.
it("lists every feature, each with its bullet", () => {
  show();

  expect(screen.getByText("Det här kan du göra")).toBeTruthy();
  expect(screen.getAllByText("•")).toHaveLength(7);
  expect(screen.getByText("Spela in dina vandringar med GPS och se hur långt du går")).toBeTruthy();
  expect(screen.getByText("Dela dina inspelade vandringar med vänner")).toBeTruthy();
});

it("offers a way to get in touch", async () => {
  show();

  expect(screen.getByText("Hör av dig")).toBeTruthy();
  await press(EMAIL);

  expect(Linking.openURL).toHaveBeenCalledWith(`mailto:${EMAIL}`);
});

// A phone with no mail client rejects openURL, and an unhandled rejection is a crash in a release build.
it("survives a device that cannot open mail", async () => {
  jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no handler"));
  show();

  await press(EMAIL);

  expect(Linking.openURL).toHaveBeenCalled();
});

it("links to the privacy policy and the terms of use", async () => {
  show();

  expect(screen.getByText(/inga annonser, analysverktyg eller spårning/)).toBeTruthy();

  await press("Läs integritetspolicyn");
  expect(Linking.openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);

  await press("Läs användarvillkoren");
  expect(Linking.openURL).toHaveBeenCalledWith(TERMS_OF_USE_URL);
});

it("survives a link that will not open", async () => {
  jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no browser"));
  show();

  await press("Läs integritetspolicyn");

  expect(Linking.openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
});

// Borås Stad's licence requires the attribution, and MapTiler's the map credit.
it("credits the trail data and the map", () => {
  show();

  expect(screen.getByText(/Borås Stads öppna dataportal/)).toBeTruthy();
  expect(screen.getByText(/Creative Commons CC0 1.0/)).toBeTruthy();
  expect(screen.getByText(/MapTiler och MapLibre/)).toBeTruthy();
  expect(screen.getByText(/OpenStreetMap under ODbL 1.0/)).toBeTruthy();
});

// AGPL §13: this link is how the source offer is made to everyone using the deployed backend.
it("names both licences and offers the source", async () => {
  show();

  expect(screen.getByText("Öppen källkod")).toBeTruthy();
  expect(screen.getByText(/Mozilla Public License 2.0/)).toBeTruthy();
  expect(screen.getByText(/GNU Affero General Public License version 3/)).toBeTruthy();

  await press(SOURCE_LINK);

  expect(Linking.openURL).toHaveBeenCalledWith(SOURCE_CODE_URL);
});

// A bug report is worth little without the build it came from.
it("shows the build's version", () => {
  show();

  expect(screen.getByText("Version 1.4.2")).toBeTruthy();
});

it("leaves the version out when the build has none, rather than an empty label", () => {
  mockVersion = undefined;
  show();

  expect(screen.queryByText(/Version/)).toBeNull();
  expect(screen.getByText("Skapad med omtanke om naturen")).toBeTruthy();
});

// iOS has no hardware back button, so the screen carries its own; Android does not.
it("goes back from the header button", async () => {
  show();

  fireEvent.press(screen.getByTestId("icon-chevron-left"));
  await settle();

  expect(mockBack).toHaveBeenCalled();
});

it("fills the screen with the theme's background", () => {
  show();

  expect(screen.getByTestId("about-screen")).toHaveStyle({
    flex: 1,
    backgroundColor: AppDefaultTheme.colors.background,
  });
});

it("fills the screen with the dark theme's background too", () => {
  show(AppDarkTheme);

  expect(screen.getByTestId("about-screen")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.background });
});

it("keeps the text off the edges of the screen", () => {
  show();

  expect(screen.getByTestId("about-content")).toHaveStyle({ paddingHorizontal: SCREEN_PADDING, gap: 16 });
});

it("draws each block as a card on the theme's container colour", () => {
  show();

  for (const section of ["features", "contact", "privacy", "data-source", "licence"]) {
    expect(screen.getByTestId(`about-section-${section}`)).toHaveStyle({
      backgroundColor: AppDefaultTheme.colors.secondaryContainer,
      borderRadius: 12,
      padding: 16,
    });
  }
});

it("draws the cards on the dark theme's container colour too", () => {
  show(AppDarkTheme);

  expect(screen.getByTestId("about-section-licence")).toHaveStyle({
    backgroundColor: AppDarkTheme.colors.secondaryContainer,
  });
});

// A feature is a long line beside a bullet, and flex is what wraps it inside the card.
it("lets a feature wrap inside its row", () => {
  show();

  expect(
    screen.getByText("Utforska och filtrera vandringsleder efter svårighetsgrad, tillgänglighet och längd"),
  ).toHaveStyle({
    flex: 1,
  });
});

// The links sit among body text, so colour and weight are what say they can be pressed.
it("marks the links as links", () => {
  show();

  for (const label of ["Läs integritetspolicyn", "Läs användarvillkoren", SOURCE_LINK, EMAIL]) {
    expect(screen.getByText(label)).toHaveStyle({ color: AppDefaultTheme.colors.primary, fontWeight: "600" });
  }
});
