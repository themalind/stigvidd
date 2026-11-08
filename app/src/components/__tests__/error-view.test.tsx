// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { useAuth } from "@/components/auth/auth-provider";
import ErrorView from "@/components/error-view";
import sv from "@/i18n/locales/sv.json";
import { SessionUnavailableError } from "@/services/keycloak-auth";
import { renderWithProviders } from "@/test/render";
import { onlineManager } from "@tanstack/react-query";
import { fireEvent, screen } from "@testing-library/react-native";

jest.mock("@/components/auth/auth-provider", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockLogout = jest.fn();

function signedIn(isAuthenticated: boolean) {
  mockUseAuth.mockReturnValue({ isAuthenticated, logout: mockLogout } as unknown as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  mockLogout.mockReset().mockResolvedValue(undefined);
});

it("offers a way back to the login when the API refuses a signed-in user", async () => {
  signedIn(true);
  await renderWithProviders(<ErrorView error={new ApiError("expired", 401)} />);

  await fireEvent.press(screen.getByText(sv.error["401"].relogin));

  expect(mockLogout).toHaveBeenCalledTimes(1);
});

it("does not offer it to a reader who is already signed out", async () => {
  signedIn(false);
  await renderWithProviders(<ErrorView error={new ApiError("expired", 401)} />);

  expect(screen.queryByText(sv.error["401"].relogin)).toBeNull();
});

it("does not offer it for other failures", async () => {
  signedIn(true);
  await renderWithProviders(<ErrorView error={new ApiError("nope", 404)} />);

  expect(screen.queryByText(sv.error["401"].relogin)).toBeNull();
});

it("shows an unreachable Keycloak as a connection problem, not as signed out", async () => {
  signedIn(true);
  await renderWithProviders(<ErrorView error={new SessionUnavailableError()} />);

  expect(screen.getByText(sv.error.default.title)).toBeTruthy();
  expect(screen.queryByText(sv.error["401"].title)).toBeNull();
});

describe("offline", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("names the missing connection instead of a generic failure", async () => {
    signedIn(true);
    onlineManager.setOnline(false);
    await renderWithProviders(<ErrorView error={new TypeError("Network request failed")} />);

    expect(screen.getByText(sv.error.offline.title)).toBeTruthy();
    expect(screen.getByText(sv.error.offline.message)).toBeTruthy();
    expect(screen.queryByText(sv.error.default.title)).toBeNull();
  });

  it("still names a server answer for what it is", async () => {
    signedIn(true);
    onlineManager.setOnline(false);
    await renderWithProviders(<ErrorView error={new ApiError("nope", 404)} />);

    expect(screen.getByText(sv.error["404"].title)).toBeTruthy();
  });
});
