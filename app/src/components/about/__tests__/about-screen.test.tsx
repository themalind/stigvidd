// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AboutScreen from "@/components/about/about-screen";
import {
  BORDER_RADIUS,
  PRIVACY_POLICY_URL,
  SCREEN_PADDING,
  SOURCE_CODE_URL,
  TERMS_OF_USE_URL,
} from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: (...args: unknown[]) => mockBack(...args) },
}));

// keep-comment: a getter, so a test can take the version away
let mockVersion: string | undefined = "1.4.2";
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { version: mockVersion };
    },
  },
}));

const EMAIL = "info@stigvidd.se";
const SOURCE_LINK = "Visa källkoden på GitHub";

function show(theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme) {
  return renderWithProviders(<AboutScreen />, { theme });
}

async function press(label: string) {
  await fireEvent.press(screen.getByText(label));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVersion = "1.4.2";
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("says what the app is for", async () => {
  await show();

  expect(screen.getByText("Stigvidd")).toBeTruthy();
  expect(screen.getByText("Upptäck leder nära dig")).toBeTruthy();
  expect(screen.getByText(/vandringsapp skapad som ett hobbyprojekt/)).toBeTruthy();
});

// keep-comment: a missing array key empties the list silently, so the count is asserted
it("lists every feature, each with its bullet", async () => {
  await show();

  expect(screen.getByText("Det här kan du göra")).toBeTruthy();
  expect(screen.getAllByText("•")).toHaveLength(13);
  expect(screen.getByText("Spela in dina vandringar med GPS och se hur långt du går")).toBeTruthy();
  expect(screen.getByText("Dela dina inspelade vandringar med vänner")).toBeTruthy();
  expect(screen.getByText("Skapa evenemang, bjud in vänner och gå tillsammans")).toBeTruthy();
  expect(screen.getByText("Låt Stigvidd slumpa fram en promenad när du inte kan bestämma dig")).toBeTruthy();
});

it("offers a way to get in touch", async () => {
  await show();

  expect(screen.getByText("Hör av dig")).toBeTruthy();
  await press(EMAIL);

  expect(Linking.openURL).toHaveBeenCalledWith(`mailto:${EMAIL}`);
});

// keep-comment: no mail client rejects openURL; unhandled, that crashes a release build
it("survives a device that cannot open mail", async () => {
  jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no handler"));
  await show();

  await press(EMAIL);

  expect(Linking.openURL).toHaveBeenCalled();
});

it("links to the privacy policy and the terms of use", async () => {
  await show();

  // keep-comment: the privacy promise: statistics are opt-in and never include a position
  expect(screen.getByText(/samlas bara in om du samtycker/)).toBeTruthy();
  expect(screen.getByText(/innehåller aldrig din position/)).toBeTruthy();

  await press("Läs integritetspolicyn");
  expect(Linking.openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);

  await press("Läs användarvillkoren");
  expect(Linking.openURL).toHaveBeenCalledWith(TERMS_OF_USE_URL);
});

it("survives a link that will not open", async () => {
  jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no browser"));
  await show();

  await press("Läs integritetspolicyn");

  expect(Linking.openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
});

// keep-comment: MapTiler's terms require the map credit
it("credits the trail data and the map", async () => {
  await show();

  expect(screen.getByText(/Borås Stads öppna dataportal/)).toBeTruthy();
  expect(screen.getByText(/Creative Commons CC0 1.0/)).toBeTruthy();
  expect(screen.getByText(/MapTiler och MapLibre/)).toBeTruthy();
  expect(screen.getByText(/OpenStreetMap under ODbL 1.0/)).toBeTruthy();
});

// keep-comment: AGPL §13 source offer to the backend's users
it("names both licences and offers the source", async () => {
  await show();

  expect(screen.getByText("Öppen källkod")).toBeTruthy();
  expect(screen.getByText(/Mozilla Public License 2.0/)).toBeTruthy();
  expect(screen.getByText(/GNU Affero General Public License version 3/)).toBeTruthy();

  await press(SOURCE_LINK);

  expect(Linking.openURL).toHaveBeenCalledWith(SOURCE_CODE_URL);
});

it("shows the build's version", async () => {
  await show();

  expect(screen.getByText("Version 1.4.2")).toBeTruthy();
});

it("leaves the version out when the build has none, rather than an empty label", async () => {
  mockVersion = undefined;
  await show();

  expect(screen.queryByText(/Version/)).toBeNull();
  expect(screen.getByText("Skapad med omtanke om naturen")).toBeTruthy();
});

it("goes back from the header button", async () => {
  await show();

  await fireEvent.press(screen.getByTestId("back-button"));
  await settle();

  expect(mockBack).toHaveBeenCalled();
});

it("fills the screen with the theme's background", async () => {
  await show();

  expect(screen.getByTestId("about-screen")).toHaveStyle({
    flex: 1,
    backgroundColor: AppDefaultTheme.colors.background,
  });
});

it("fills the screen with the dark theme's background too", async () => {
  await show(AppDarkTheme);

  expect(screen.getByTestId("about-screen")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.background });
});

it("keeps the text off the edges of the screen", async () => {
  await show();

  expect(screen.getByTestId("about-content")).toHaveStyle({ paddingHorizontal: SCREEN_PADDING, gap: 16 });
});

it("draws each block as a card on the theme's container colour", async () => {
  await show();

  for (const section of ["features", "contact", "privacy", "data-source", "licence"]) {
    expect(screen.getByTestId(`about-section-${section}`)).toHaveStyle({
      backgroundColor: AppDefaultTheme.colors.secondaryContainer,
      borderRadius: BORDER_RADIUS,
      padding: 16,
    });
  }
});

it("draws the cards on the dark theme's container colour too", async () => {
  await show(AppDarkTheme);

  expect(screen.getByTestId("about-section-licence")).toHaveStyle({
    backgroundColor: AppDarkTheme.colors.secondaryContainer,
  });
});

it("lets a feature wrap inside its row", async () => {
  await show();

  expect(
    screen.getByText("Utforska och filtrera vandringsleder efter svårighetsgrad, tillgänglighet och längd"),
  ).toHaveStyle({
    flex: 1,
  });
});

it("marks the links as links", async () => {
  await show();

  for (const label of ["Läs integritetspolicyn", "Läs användarvillkoren", SOURCE_LINK, EMAIL]) {
    expect(screen.getByText(label)).toHaveStyle({ color: AppDefaultTheme.colors.primary, fontWeight: "600" });
  }
});
