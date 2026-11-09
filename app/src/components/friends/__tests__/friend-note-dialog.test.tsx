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

function dialog(visible: boolean, note: string | null) {
  return <FriendNoteDialog visible={visible} nickName="anna" note={note} onDismiss={onDismiss} onSave={onSave} />;
}

it("drops a discarded edit when it is opened again", async () => {
  const { rerender } = await renderWithProviders(dialog(true, "Från jobbet"));
  await fireEvent.changeText(screen.getByTestId("note-input"), "Halvskriven");

  await rerender(dialog(false, "Från jobbet"));
  await rerender(dialog(true, "Från jobbet"));

  expect(screen.getByTestId("note-input")).toHaveDisplayValue("Från jobbet");
});

it("picks up a note that changes while it is open", async () => {
  const { rerender } = await renderWithProviders(dialog(true, "Från jobbet"));

  await rerender(dialog(true, "Från klubben"));

  expect(screen.getByTestId("note-input")).toHaveDisplayValue("Från klubben");
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
