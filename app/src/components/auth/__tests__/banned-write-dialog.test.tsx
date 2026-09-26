// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { getStigViddUser } from "@/api/users";
import { userAtom } from "@/atoms/auth-atoms";
import { BannedWriteDialog } from "@/components/auth/banned-write-dialog";
import sv from "@/i18n/locales/sv.json";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { useMutation } from "@tanstack/react-query";
import { fireEvent, screen } from "@testing-library/react-native";
import { Linking, Pressable, Text } from "react-native";

jest.mock("@/api/users", () => ({ getStigViddUser: jest.fn() }));

const mockGetUser = getStigViddUser as jest.MockedFunction<typeof getStigViddUser>;

const SIGNED_IN = { id: "subject-1", email: "a@b.se", username: "a" };

function FailingWrite({ error }: { error: Error }) {
  const mutation = useMutation({ mutationFn: () => Promise.reject(error) });
  return (
    <Pressable testID="write" onPress={() => mutation.mutate()}>
      <Text>{mutation.isError ? "failed" : "write"}</Text>
    </Pressable>
  );
}

async function show(error: Error, signedIn = true) {
  renderWithProviders(
    <>
      <FailingWrite error={error} />
      <BannedWriteDialog />
    </>,
    { initialAtoms: signedIn ? [[userAtom, SIGNED_IN]] : [] },
  );
  fireEvent.press(screen.getByTestId("write"));
  await flushUntil(() => screen.queryByText("failed"));
}

function profile(bannedAt: string | null) {
  return { identifier: "u1", nickName: "a", email: "a@b.se", bannedAt, myWishList: [], myFavorites: [] };
}

beforeEach(() => {
  mockGetUser.mockReset();
});

it("names the ban when a write is refused and the profile now says banned", async () => {
  mockGetUser.mockResolvedValue(profile("2026-09-25T10:00:00Z"));

  await show(new ApiError("refused", 403));
  await flushUntil(() => screen.queryByText(sv.ban.title));

  expect(screen.getByText(sv.ban.title)).toBeTruthy();
  expect(screen.getAllByText(sv.common.ok)).toHaveLength(1);
});

it("opens a mail to the contact address from the dialog", async () => {
  const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  mockGetUser.mockResolvedValue(profile("2026-09-25T10:00:00Z"));

  await show(new ApiError("refused", 403));
  await flushUntil(() => screen.queryByText(sv.about.contactEmail));
  fireEvent.press(screen.getByText(sv.about.contactEmail));

  expect(openURL).toHaveBeenCalledWith("mailto:info@stigvidd.se");
  openURL.mockRestore();
});

it("stays quiet on a 403 that is not a ban", async () => {
  mockGetUser.mockResolvedValue(profile(null));

  await show(new ApiError("not yours", 403));
  await flushUntil(() => mockGetUser.mock.calls.length > 0);
  await settle();

  expect(screen.queryByText(sv.ban.title)).toBeNull();
});

it("does not re-read the profile for a failure that is not a 403", async () => {
  await show(new ApiError("server error", 500));
  await settle();

  expect(mockGetUser).not.toHaveBeenCalled();
  expect(screen.queryByText(sv.ban.title)).toBeNull();
});

it("does nothing for a signed-out reader", async () => {
  await show(new ApiError("refused", 403), false);
  await settle();

  expect(mockGetUser).not.toHaveBeenCalled();
});
