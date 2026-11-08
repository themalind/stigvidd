// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import FriendNoteDialog from "../friend-note-dialog";

const onSave = jest.fn();
const onDismiss = jest.fn();

async function show(note: string | null) {
  await renderWithProviders(
    <FriendNoteDialog visible nickName="anna" note={note} onDismiss={onDismiss} onSave={onSave} />,
  );
}

beforeEach(() => jest.clearAllMocks());

it("saves the trimmed text and closes", async () => {
  await show(null);

  await fireEvent.changeText(screen.getByTestId("note-input"), "  Från jobbet  ");
  await fireEvent.press(screen.getByTestId("note-save"));

  expect(onSave).toHaveBeenCalledWith("Från jobbet");
  expect(onDismiss).toHaveBeenCalled();
});

it("cannot save an unchanged note", async () => {
  await show("Från jobbet");

  await fireEvent.press(screen.getByTestId("note-save"));

  expect(onSave).not.toHaveBeenCalled();
});

it("saves a cleared note as a removal", async () => {
  await show("Från jobbet");

  await fireEvent.changeText(screen.getByTestId("note-input"), "   ");
  await fireEvent.press(screen.getByTestId("note-save"));

  expect(onSave).toHaveBeenCalledWith(null);
});

it("offers removal only when there is a note", async () => {
  await show(null);

  expect(screen.queryByTestId("note-remove")).toBeNull();
  expect(screen.getByText("Bara du ser anteckningen.")).toBeTruthy();
});

it("caps the note at the backend's limit", async () => {
  await show(null);

  expect(screen.getByTestId("note-input").props.maxLength).toBe(60);
});
