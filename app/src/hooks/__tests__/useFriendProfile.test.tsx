// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useFriendProfile } from "@/hooks/friends/useFriendProfile";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";

const mockGetFriendProfile = jest.fn();

jest.mock("@/api/friends", () => ({
  getFriendProfile: (...args: unknown[]) => mockGetFriendProfile(...args),
}));

let mockIsAuthenticated = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

let mockUser: { identifier: string } | undefined;
jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom(() => ({ data: mockUser })) };
});

const PROFILE = { reviews: [], publishedTrails: [] };

type Result = ReturnType<typeof useFriendProfile>;

function render(friendIdentifier: string | undefined) {
  let hook: Result | undefined;
  function Probe() {
    hook = useFriendProfile(friendIdentifier);
    return null;
  }

  const rendered = renderWithProviders(<Probe />);
  const current = () => {
    if (!hook) throw new Error("expected the hook to have rendered");
    return hook;
  };
  return { ...rendered, hook: current };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockUser = { identifier: "me" };
  mockGetFriendProfile.mockResolvedValue(PROFILE);
});

it("fetches the friend's profile", async () => {
  const { hook } = render("id-anna");
  await flushUntil(() => hook().isSuccess);

  expect(mockGetFriendProfile).toHaveBeenCalledWith("id-anna");
  expect(hook().data).toEqual(PROFILE);
});

it("keys the profile by viewer and friend, so two accounts on one device never share it", async () => {
  const { hook, queryClient } = render("id-anna");
  await flushUntil(() => hook().isSuccess);

  expect(queryClient.getQueryData(["friends", "profile", "me", "id-anna"])).toEqual(PROFILE);
});

it.each([
  ["signed out", () => (mockIsAuthenticated = false), "id-anna"],
  ["the user is not loaded yet", () => (mockUser = undefined), "id-anna"],
  ["there is no friend to ask about", () => undefined, undefined],
])("asks nothing while %s", async (_, arrange, friend) => {
  arrange();
  render(friend);
  await settle();

  expect(mockGetFriendProfile).not.toHaveBeenCalled();
});
