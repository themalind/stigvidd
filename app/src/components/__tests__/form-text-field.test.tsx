// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import FormTextField from "@/components/form-text-field";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { FieldError, useForm } from "react-hook-form";

function Field({ error }: { error?: FieldError }) {
  const { control } = useForm<{ note: string }>({ defaultValues: { note: "hej" } });
  return <FormTextField name="note" testID="note" label="Anteckning" control={control} maxLength={10} error={error} />;
}

it("binds the form value and counts it against the limit", () => {
  renderWithProviders(<Field />);

  expect(screen.getByTestId("note")).toHaveProp("value", "hej");
  expect(screen.getByTestId("note-count")).toHaveTextContent("3/10");

  fireEvent.changeText(screen.getByTestId("note"), "hej hopp");

  expect(screen.getByTestId("note-count")).toHaveTextContent("8/10");
});

it("shows no error until one is passed in", () => {
  renderWithProviders(<Field />);

  expect(screen.queryByTestId("note-error")).toBeNull();
});

it("translates the error message under the field", () => {
  renderWithProviders(<Field error={{ type: "too_small", message: "hike.nameTooShort" }} />);

  expect(screen.getByTestId("note-error")).toHaveTextContent("Namnet är för kort. Minst 3 tecken");
});
