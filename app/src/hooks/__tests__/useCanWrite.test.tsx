// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useCanWrite } from "@/hooks/useCanWrite";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";
import { Text } from "react-native";

let mockIsAuthenticated = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

let mockUser: { bannedAt?: string | null } | undefined = {};
jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom(() => ({ data: mockUser })) };
});

function Probe() {
  const { canWrite, reason } = useCanWrite();
  return <Text testID="probe">{`${canWrite}:${reason}`}</Text>;
}

beforeEach(() => {
  mockIsAuthenticated = true;
  mockUser = {};
});

describe("useCanWrite", () => {
  it("lets an ordinary signed-in user write", () => {
    renderWithProviders(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("true:null");
  });

  it("names the ban, so the screen can explain rather than just refuse", () => {
    mockUser = { bannedAt: "2026-03-04T10:00:00Z" };
    renderWithProviders(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("false:banned");
  });

  it("puts signing out first, since a signed-out user has no ban to report", () => {
    mockIsAuthenticated = false;
    mockUser = { bannedAt: "2026-03-04T10:00:00Z" };
    renderWithProviders(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("false:unauthenticated");
  });

  // The profile arrives after the first render, and the buttons stay live across that gap.
  it("allows the write while the profile is still loading", () => {
    mockUser = undefined;
    renderWithProviders(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("true:null");
  });
});
