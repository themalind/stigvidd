// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import UserPicker from "@/components/user/user-picker";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

jest.mock("@/api/friends", () => ({ getFriends: jest.fn(), searchUsers: jest.fn() }));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { nickName: "me" } }) };
});

function picker(dropNickNames?: string[]) {
  return (
    <UserPicker
      enabled={false}
      searchable
      initialSelected={["anna", "bo"]}
      dropNickNames={dropNickNames}
      onSubmit={jest.fn()}
      submitLabel={(count) => `Skicka ${count}`}
      submitIcon="send"
      emptyText="Inga vänner"
      limitText="Max"
    />
  );
}

it("takes a dropped name out of the selection when the list changes", async () => {
  const { rerender } = await renderWithProviders(picker());
  expect(screen.getByTestId("user-picker-chip-anna")).toBeTruthy();

  await rerender(picker(["anna"]));

  expect(screen.queryByTestId("user-picker-chip-anna")).toBeNull();
  expect(screen.getByTestId("user-picker-chip-bo")).toBeTruthy();
});

it("drops a name that is already on the list when it opens", async () => {
  await renderWithProviders(picker(["bo"]));

  expect(screen.queryByTestId("user-picker-chip-bo")).toBeNull();
  expect(screen.getByTestId("user-picker-chip-anna")).toBeTruthy();
});

it("keeps the selection when nothing is dropped", async () => {
  await renderWithProviders(picker([]));

  expect(screen.getByText("Skicka 2")).toBeTruthy();
});
