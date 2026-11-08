// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { loginReturnPathAtom, userAtom } from "@/atoms/auth-atoms";
import SignInPrompt from "@/components/auth/sign-in-prompt";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";

const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  usePathname: () => "/events/event/ev1",
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SignInPrompt", () => {
  it("remembers the screen it was shown on and opens the login", async () => {
    const { store } = await renderWithProviders(<SignInPrompt message="Logga in" />);

    await fireEvent.press(screen.getByTestId("sign-in-prompt-login"));

    expect(store.get(loginReturnPathAtom)).toBe("/events/event/ev1");
    expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/(profile-stack)/login");
  });

  it("forgets the screen when the user leaves it still signed out", async () => {
    const { store, unmount } = await renderWithProviders(<SignInPrompt message="Logga in" />);
    await fireEvent.press(screen.getByTestId("sign-in-prompt-login"));

    await unmount();

    expect(store.get(loginReturnPathAtom)).toBeNull();
  });

  it("keeps the screen when it goes away because the login succeeded", async () => {
    const { store, unmount } = await renderWithProviders(<SignInPrompt message="Logga in" />);
    await fireEvent.press(screen.getByTestId("sign-in-prompt-login"));

    await act(() => {
      store.set(userAtom, { id: "u1", email: "a@b.se", username: "jag" });
    });
    await unmount();

    expect(store.get(loginReturnPathAtom)).toBe("/events/event/ev1");
  });
});
