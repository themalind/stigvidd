// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ListSection from "@/components/list-section";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { ComponentProps } from "react";
import { Text } from "react-native";

const names = (count: number) => Array.from({ length: count }, (_, i) => `person-${i + 1}`);

function show(props: Partial<ComponentProps<typeof ListSection<string>>> = {}) {
  renderWithProviders(
    <ListSection<string>
      testID="section"
      title="Vänner"
      icon="account-group"
      items={names(2)}
      keyOf={(name) => name}
      renderItem={(name) => <Text>{name}</Text>}
      {...props}
    />,
  );
}

it("renders the title and every item", () => {
  show();

  expect(screen.getByText("Vänner")).toBeTruthy();
  expect(screen.getByText("person-1")).toBeTruthy();
  expect(screen.getByText("person-2")).toBeTruthy();
});

it("previews the first items and expands to all on request", () => {
  show({ items: names(7), previewCount: 5 });

  expect(screen.queryByText("person-6")).toBeNull();
  fireEvent.press(screen.getByText("Visa alla (7)"));
  expect(screen.getByText("person-7")).toBeTruthy();

  fireEvent.press(screen.getByText("Visa färre"));
  expect(screen.queryByText("person-6")).toBeNull();
});

it("offers no expand button when everything already fits", () => {
  show({ items: names(5), previewCount: 5 });

  expect(screen.queryByText(/Visa alla/)).toBeNull();
});

it("renders nothing for an empty list without an empty text", () => {
  show({ items: [] });

  expect(screen.queryByTestId("section")).toBeNull();
});

it("says so for an empty list with an empty text", () => {
  show({ items: [], emptyText: "Inga vänner än" });

  expect(screen.getByText("Inga vänner än")).toBeTruthy();
});

it("shows a loader rather than the empty text while pending", () => {
  show({ items: undefined, isPending: true, emptyText: "Inga vänner än" });

  expect(screen.getByTestId("section")).toBeTruthy();
  expect(screen.queryByText("Inga vänner än")).toBeNull();
});

it("shows the error with a retry instead of the items", () => {
  const onRetry = jest.fn();
  show({ isError: true, errorText: "Kunde inte hämta", onRetry });

  expect(screen.queryByText("person-1")).toBeNull();
  expect(screen.getByText("Kunde inte hämta")).toBeTruthy();
  fireEvent.press(screen.getByText("Försök igen"));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
