// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import CountedTextInput from "@/components/counted-text-input";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

it("counts the value against maxLength under the input's testID", () => {
  renderWithProviders(<CountedTextInput testID="note" value="hej" maxLength={300} />);

  expect(screen.getByTestId("note-count")).toHaveTextContent("3/300");
});

it("passes props through to the input", () => {
  const onChangeText = jest.fn();
  renderWithProviders(<CountedTextInput testID="note" value="" maxLength={300} onChangeText={onChangeText} />);

  fireEvent.changeText(screen.getByTestId("note"), "ny text");

  expect(onChangeText).toHaveBeenCalledWith("ny text");
  expect(screen.getByTestId("note")).toHaveProp("maxLength", 300);
});
