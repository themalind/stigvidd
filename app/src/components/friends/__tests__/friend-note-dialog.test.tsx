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

function show(note: string | null) {
  renderWithProviders(<FriendNoteDialog visible nickName="anna" note={note} onDismiss={onDismiss} onSave={onSave} />);
}

beforeEach(() => jest.clearAllMocks());

it("saves the trimmed text and closes", () => {
  show(null);

  fireEvent.changeText(screen.getByTestId("note-input"), "  Från jobbet  ");
  fireEvent.press(screen.getByTestId("note-save"));

  expect(onSave).toHaveBeenCalledWith("Från jobbet");
  expect(onDismiss).toHaveBeenCalled();
});

it("cannot save an unchanged note", () => {
  show("Från jobbet");

  fireEvent.press(screen.getByTestId("note-save"));

  expect(onSave).not.toHaveBeenCalled();
});

it("saves a cleared note as a removal", () => {
  show("Från jobbet");

  fireEvent.changeText(screen.getByTestId("note-input"), "   ");
  fireEvent.press(screen.getByTestId("note-save"));

  expect(onSave).toHaveBeenCalledWith(null);
});

it("offers removal only when there is a note", () => {
  show(null);

  expect(screen.queryByTestId("note-remove")).toBeNull();
  expect(screen.getByText("Bara du ser anteckningen.")).toBeTruthy();
});

it("caps the note at the backend's limit", () => {
  show(null);

  expect(screen.getByTestId("note-input").props.maxLength).toBe(60);
});
