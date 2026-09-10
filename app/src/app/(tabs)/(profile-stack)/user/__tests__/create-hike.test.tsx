// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import CreateHikeScreen from "@/app/(tabs)/(profile-stack)/user/create-hike";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { SCREEN_PADDING } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { USER_LOCATION_KEY } from "@/hooks/useUserLocation";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { QueryClient } from "@tanstack/react-query";
import { fireEvent, screen } from "@testing-library/react-native";
import { ActivityIndicator, AppState, AppStateStatus, Linking, Platform } from "react-native";
import { Dialog } from "react-native-paper";

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: () => mockGetPermissions(),
  requestForegroundPermissionsAsync: () => mockRequestPermissions(),
  Accuracy: { Balanced: 3 },
}));

jest.mock("expo-router", () => ({
  router: {
    back: () => mockBack(),
    canGoBack: () => mockCanGoBack(),
  },
}));

// TrailCreator has its own suite; this screen only decides whether it may appear.
jest.mock("@/components/trail/trail-creator/trail-creator", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { __esModule: true, default: () => React.createElement(View, { testID: "trail-creator" }) };
});

// location-task registers a background task at import; only the dialog's two limits are needed.
jest.mock("@/services/location-task", () => ({
  INACTIVITY_TIMEOUT: 60 * 60 * 1000,
  MAX_DURATION: 12 * 60 * 60 * 1000,
}));

// A plain atom lets each test state the user's load outcome directly.
jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ isLoading: false, isError: false, error: null }) };
});

interface UserState {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
}

function user({ isLoading = false, isError = false, error = null }: UserState = {}) {
  return [[stigviddUserAtom, { isLoading, isError, error }]] as [unknown, unknown][];
}

// The AppState listener the screen installs for a return from settings, and its unsubscribe.
let onAppState: ((state: AppStateStatus) => void) | null = null;
const mockRemoveListener = jest.fn();
let invalidate: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  onAppState = null;
  mockCanGoBack.mockReturnValue(false);
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    onAppState = listener as (state: AppStateStatus) => void;
    return { remove: mockRemoveListener };
  });
  // renderWithProviders builds the client, so the screen's invalidation is observed on the prototype.
  invalidate = jest.spyOn(QueryClient.prototype, "invalidateQueries");
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function foreground(state: AppStateStatus = "active") {
  await settle();
  onAppState?.(state);
  await settle();
}

type AppTheme = typeof AppDefaultTheme | typeof AppDarkTheme;

async function showGranted(atoms = user(), theme: AppTheme = AppDefaultTheme) {
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  const rendered = renderWithProviders(<CreateHikeScreen />, { initialAtoms: atoms, theme });
  await flushUntil(() => screen.queryByTestId("create-hike-screen"));
  return rendered;
}

async function showDisclosure(atoms = user()) {
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
  const rendered = renderWithProviders(<CreateHikeScreen />, { initialAtoms: atoms });
  await flushUntil(() => screen.queryByText("Stigvidd behöver din plats"));
  return rendered;
}

// The denied screen is reached only by refusing the prompt.
async function showDenied({ canAskAgain = true, atoms = user(), theme = AppDefaultTheme as AppTheme } = {}) {
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
  mockRequestPermissions.mockResolvedValue({ granted: false, canAskAgain });
  const rendered = renderWithProviders(<CreateHikeScreen />, { initialAtoms: atoms, theme });
  await flushUntil(() => screen.queryByText("Fortsätt"));
  fireEvent.press(screen.getByText("Fortsätt"));
  await flushUntil(() => screen.queryByTestId("create-hike-denied"));
  return rendered;
}

// Paper's Icon hides itself from accessibility, so it needs includeHiddenElements.
function paperIcon(name: string) {
  return screen.queryByTestId(`icon-${name}`, { includeHiddenElements: true });
}

// --- the permission gate ---------------------------------------------------------------

// The disclosure stands ahead of the system prompt: the mount reads the status, never asks.
it("reads the current permission on arrival and never prompts for it", async () => {
  await showDisclosure();

  expect(mockGetPermissions).toHaveBeenCalled();
  expect(mockRequestPermissions).not.toHaveBeenCalled();
});

it("shows nothing but a spinner while the status is still being read", () => {
  mockGetPermissions.mockReturnValue(new Promise(() => {}));
  renderWithProviders(<CreateHikeScreen />, { initialAtoms: user() });

  expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  expect(screen.queryByText("Stigvidd behöver din plats")).toBeNull();
  expect(screen.queryByTestId("trail-creator")).toBeNull();
});

// The creator saves against the signed-in user, so it waits for that user.
it("waits for the user too, not only for the permission", async () => {
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  renderWithProviders(<CreateHikeScreen />, { initialAtoms: user({ isLoading: true }) });
  await settle();

  expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  expect(screen.queryByTestId("trail-creator")).toBeNull();
});

// An already-granted permission is not prompted for again.
it("goes straight to the creator when the permission is already granted", async () => {
  await showGranted();

  expect(screen.getByTestId("trail-creator")).toBeTruthy();
  expect(screen.queryByText("Stigvidd behöver din plats")).toBeNull();
});

it("puts the disclosure in the way when the permission is missing", async () => {
  await showDisclosure();

  expect(screen.getByText("Stigvidd behöver din plats")).toBeTruthy();
  expect(screen.getByText(/spelar Stigvidd in var du befinner dig/)).toBeTruthy();
  expect(screen.getByText(/appen ligger i bakgrunden/)).toBeTruthy();
  expect(screen.getByText(/delas inte med någon annan/)).toBeTruthy();
  expect(screen.getByText(/medan du aktivt spelar in/)).toBeTruthy();
  expect(screen.queryByTestId("trail-creator")).toBeNull();
});

// The disclosure takes an explicit choice; a tap outside does not dismiss it.
it("does not let the disclosure be tapped away", async () => {
  await showDisclosure();

  expect(screen.UNSAFE_getByType(Dialog).props.dismissable).toBe(false);
});

it("raises the system prompt on Fortsätt", async () => {
  await showDisclosure();
  mockRequestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });

  fireEvent.press(screen.getByText("Fortsätt"));
  await settle();

  expect(mockRequestPermissions).toHaveBeenCalled();
});

it("opens the creator once the prompt is granted", async () => {
  await showDisclosure();
  mockRequestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });

  fireEvent.press(screen.getByText("Fortsätt"));
  await flushUntil(() => screen.queryByTestId("trail-creator"));

  expect(screen.getByTestId("trail-creator")).toBeTruthy();
  expect(screen.queryByText("Stigvidd behöver din plats")).toBeNull();
});

// A permission granted in-app refreshes the shared userLocation query, which otherwise keeps the
// Borås fallback for the home hero, the map camera and every trail distance.
it("refreshes the shared location query when the permission arrives", async () => {
  await showDisclosure();
  mockRequestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });

  fireEvent.press(screen.getByText("Fortsätt"));
  await flushUntil(() => screen.queryByTestId("trail-creator"));

  expect(invalidate).toHaveBeenCalledWith({ queryKey: USER_LOCATION_KEY });
});

it("shows the denied screen when the prompt is refused", async () => {
  await showDenied();

  expect(screen.getByText("Platsåtkomst behövs")).toBeTruthy();
  expect(screen.getByText(/Du behöver dela din plats/)).toBeTruthy();
  expect(paperIcon("map-marker-off-outline")).toBeTruthy();
});

it("leaves the screen on Inte nu when there is somewhere to go back to", async () => {
  mockCanGoBack.mockReturnValue(true);
  await showDisclosure();

  fireEvent.press(screen.getByText("Inte nu"));
  await settle();

  expect(mockBack).toHaveBeenCalled();
});

// There is no back stack on the tab's first screen, so the dialog cannot close through router.back().
it("falls back to the denied screen on Inte nu when there is no back stack", async () => {
  mockCanGoBack.mockReturnValue(false);
  await showDisclosure();

  fireEvent.press(screen.getByText("Inte nu"));
  await flushUntil(() => screen.queryByTestId("create-hike-denied"));

  expect(screen.getByText("Platsåtkomst behövs")).toBeTruthy();
  expect(mockBack).not.toHaveBeenCalled();
});

// --- the denied screen -----------------------------------------------------------------

it("offers another try while the OS still allows the prompt", async () => {
  await showDenied({ canAskAgain: true });

  expect(screen.getByText("Tillåt plats")).toBeTruthy();
  expect(screen.queryByText(/under Plats i appens inställningar/)).toBeNull();
  expect(screen.queryByText("Öppna inställningar")).toBeNull();
});

it("asks again from the denied screen, and moves on when it is granted", async () => {
  await showDenied({ canAskAgain: true });
  mockRequestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });

  fireEvent.press(screen.getByText("Tillåt plats"));
  await flushUntil(() => screen.queryByTestId("trail-creator"));

  expect(screen.getByTestId("trail-creator")).toBeTruthy();
});

// Once the OS stops offering the prompt, the only way back is the settings app.
it("sends the user to settings once the OS stops offering the prompt", async () => {
  await showDenied({ canAskAgain: false });

  expect(screen.queryByText("Tillåt plats")).toBeNull();
  expect(screen.getByText(/under Plats i appens inställningar/)).toBeTruthy();
  expect(screen.getByText("Öppna inställningar")).toBeTruthy();
});

it("opens the system settings from that button", async () => {
  const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
  await showDenied({ canAskAgain: false });

  fireEvent.press(screen.getByText("Öppna inställningar"));
  await settle();

  expect(openSettings).toHaveBeenCalled();
});

// openSettings rejects where there is no settings deep link, and the rejection is handled.
it("survives a settings call the platform refuses", async () => {
  jest.spyOn(Linking, "openSettings").mockRejectedValue(new Error("unsupported"));
  await showDenied({ canAskAgain: false });

  fireEvent.press(screen.getByText("Öppna inställningar"));
  await settle();

  expect(screen.getByTestId("create-hike-denied")).toBeTruthy();
});

// --- the return from settings ----------------------------------------------------------

it("listens for a foreground return only while the permission is denied", async () => {
  await showGranted();
  expect(AppState.addEventListener).not.toHaveBeenCalled();

  screen.unmount();
  await showDenied();
  expect(AppState.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
});

// The AppState listener only reads the permission status; requesting from it livelocks the
// Android permission dialog.
it("reads the status on a foreground return rather than prompting again", async () => {
  await showDenied();
  mockGetPermissions.mockClear();
  mockRequestPermissions.mockClear();
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });

  await foreground();

  expect(mockGetPermissions).toHaveBeenCalled();
  expect(mockRequestPermissions).not.toHaveBeenCalled();
});

it("picks up a permission granted in the settings app", async () => {
  await showDenied();
  invalidate.mockClear();
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: false });

  await foreground();

  expect(screen.getByTestId("trail-creator")).toBeTruthy();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: USER_LOCATION_KEY });
});

// The user may have switched "ask every time" to "never" while away, which kills the retry button.
it("refreshes whether the OS will still ask, on the way back", async () => {
  await showDenied({ canAskAgain: true });
  expect(screen.getByText("Tillåt plats")).toBeTruthy();

  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
  await foreground();

  expect(screen.queryByText("Tillåt plats")).toBeNull();
  expect(screen.getByText("Öppna inställningar")).toBeTruthy();
});

it("ignores transitions that are not a return to the foreground", async () => {
  await showDenied();
  mockGetPermissions.mockClear();

  await foreground("background");
  await foreground("inactive");

  expect(mockGetPermissions).not.toHaveBeenCalled();
});

// The listener has no business being live during a recording.
it("drops the listener once the permission comes through", async () => {
  await showDenied();
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: false });

  await foreground();

  expect(mockRemoveListener).toHaveBeenCalled();
});

// --- the failed user load --------------------------------------------------------------

it("shows the error view when the user could not be loaded", async () => {
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  renderWithProviders(<CreateHikeScreen />, {
    initialAtoms: user({ isError: true, error: new ApiError("nope", 404) }),
  });
  await flushUntil(() => screen.queryByText("Hittades inte"));

  expect(screen.getByText("Hittades inte")).toBeTruthy();
  expect(screen.queryByTestId("trail-creator")).toBeNull();
});

// Both are broken, but only one of them is something the user can act on from here.
it("puts the permission problem ahead of the failed user load", async () => {
  await showDenied({ atoms: user({ isError: true, error: new ApiError("nope", 404) }) });

  expect(screen.getByText("Platsåtkomst behövs")).toBeTruthy();
  expect(screen.queryByText("Hittades inte")).toBeNull();
});

// --- chrome ----------------------------------------------------------------------------

it("heads the creator with a back button, the title and the info button", async () => {
  await showGranted();

  expect(screen.getByText("Skapa promenad")).toBeTruthy();
  expect(screen.getByTestId("create-hike-info")).toBeTruthy();
  expect(paperIcon("chevron-left")).toBeTruthy();
});

// Android draws its own back affordance in the header, so the screen adds none.
it("leaves the back arrow to Android's own header", async () => {
  Platform.OS = "android";
  try {
    await showGranted();
    expect(paperIcon("chevron-left")).toBeNull();
    expect(screen.getByText("Skapa promenad")).toBeTruthy();
  } finally {
    Platform.OS = "ios";
  }
});

it("keeps the recording rules behind the info button", async () => {
  await showGranted();
  expect(screen.queryByText("Innan du börjar")).toBeNull();

  fireEvent.press(screen.getByTestId("create-hike-info"));
  await flushUntil(() => screen.queryByText("Innan du börjar"));

  expect(screen.getByText(/Inspelningen fortsätter i bakgrunden/)).toBeTruthy();
  expect(screen.getByText(/60 minuter stoppas inspelningen/)).toBeTruthy();
  expect(screen.getByText(/efter 12 timmar/)).toBeTruthy();
  expect(screen.getByText(/trimma början och slutet/)).toBeTruthy();
});

// Opened as a reference, the dialog drops the Start button and the "don't show again" opt-out.
it("opens that dialog as a reference, not as the start confirmation", async () => {
  await showGranted();

  fireEvent.press(screen.getByTestId("create-hike-info"));
  await flushUntil(() => screen.queryByText("Innan du börjar"));

  expect(screen.getByText("Ok")).toBeTruthy();
  expect(screen.queryByText("Starta vandring")).toBeNull();
  expect(screen.queryByText("Visa inte detta igen")).toBeNull();
});

it("closes the info dialog again", async () => {
  await showGranted();
  fireEvent.press(screen.getByTestId("create-hike-info"));
  await flushUntil(() => screen.queryByText("Innan du börjar"));

  fireEvent.press(screen.getByText("Ok"));
  await flushUntil(() => !screen.queryByText("Innan du börjar"));

  expect(screen.queryByText("Innan du börjar")).toBeNull();
});

// --- layout and colour -----------------------------------------------------------------

it("sits on the theme's background, in both themes", async () => {
  await showGranted();
  expect(screen.getByTestId("create-hike-screen")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.background,
  });

  screen.unmount();
  await showGranted(user(), AppDarkTheme);
  expect(screen.getByTestId("create-hike-screen")).toHaveStyle({
    backgroundColor: AppDarkTheme.colors.background,
  });
});

it("gives the creator the full height below the header, inset by the screen padding", async () => {
  await showGranted();

  expect(screen.getByTestId("create-hike-screen")).toHaveStyle({ flex: 1, paddingTop: 8, paddingBottom: 20 });
  expect(screen.getByTestId("create-hike-content")).toHaveStyle({
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
  });
});

// The back button carries its own 4 px inset, so the header adds none on iOS; StyleSheet.create
// resolves the Platform.select at import.
it("lays the header out in a row without doubling the back button's inset", async () => {
  await showGranted();

  expect(screen.getByTestId("create-hike-header")).toHaveStyle({
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 0,
    paddingBottom: 8,
  });
});

it("draws the denied state's icon as a filled circle in the theme's container colour", async () => {
  await showDenied({ theme: AppDarkTheme });

  expect(screen.getByTestId("create-hike-denied-icon")).toHaveStyle({
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppDarkTheme.colors.secondaryContainer,
  });
  expect(paperIcon("map-marker-off-outline")?.props.color).toBe(AppDarkTheme.colors.onSecondaryContainer);
});

// A full-width line of explanation reads badly centred; the cap is what keeps it a block.
it("centres the denied explanation and caps its width", async () => {
  await showDenied();

  expect(screen.getByText(/Du behöver dela din plats/)).toHaveStyle({ textAlign: "center", maxWidth: 320 });
  expect(screen.getByText("Platsåtkomst behövs")).toHaveStyle({ textAlign: "center", fontSize: 18 });
});
