// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import UserShare from "@/components/trail/user-action-bar/user-share";
import { flushUntilGone, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const UNAVAILABLE = "Att dela en promenad är inte möjligt under testperioden.";

describe("UserShare", () => {
  it("offers to share", () => {
    renderWithProviders(<UserShare />);

    expect(screen.getByText("Dela")).toBeTruthy();
    expect(screen.getByTestId("icon-share")).toBeTruthy();
  });

  it("says nothing until pressed", () => {
    renderWithProviders(<UserShare />);
    expect(screen.queryByText(UNAVAILABLE)).toBeNull();
  });

  // Sharing a walk is not built yet, so the button exists to explain that rather than to act.
  it("explains that sharing is unavailable during the test period", async () => {
    renderWithProviders(<UserShare />);
    fireEvent.press(screen.getByText("Dela"));
    await settle();

    expect(screen.getByText("Dela en promenad")).toBeTruthy();
    expect(screen.getByText(UNAVAILABLE)).toBeTruthy();
  });

  it("closes the dialog again", async () => {
    renderWithProviders(<UserShare />);
    fireEvent.press(screen.getByText("Dela"));
    await settle();

    fireEvent.press(screen.getByText("Ok"));
    await flushUntilGone(() => screen.queryByText(UNAVAILABLE));

    expect(screen.queryByText(UNAVAILABLE)).toBeNull();
  });

  // A Pressable's style is a function of the press state, and pressing leaves no trace in the
  // tree — so the function is found on an ancestor of the label and called directly.
  it("dims while held", () => {
    renderWithProviders(<UserShare />);

    type StyledNode = { props: { style?: unknown }; parent: StyledNode | null };
    let node = screen.getByText("Dela") as unknown as StyledNode | null;
    while (node && typeof node.props?.style !== "function") {
      node = node.parent;
    }
    const style = node!.props.style as (state: { pressed: boolean }) => unknown[];

    expect(style({ pressed: true })).toContainEqual({ opacity: 0.7 });
    expect(style({ pressed: false })).not.toContainEqual({ opacity: 0.7 });
  });
});
