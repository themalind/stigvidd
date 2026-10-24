// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import UserShare, { trailShareUrl } from "@/components/trail/user-action-bar/user-share";
import { logger } from "@/services/logger";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Share } from "react-native";

jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const TRAIL = { identifier: "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1", name: "Kronängsleden" };
const URL = "https://link.stigvidd.se/trail/0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";

describe("UserShare", () => {
  let share: jest.SpyInstance;

  beforeEach(() => {
    share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });
  });

  afterEach(() => {
    share.mockRestore();
  });

  it("offers to share", () => {
    renderWithProviders(<UserShare trail={TRAIL} />);

    expect(screen.getByText("Dela")).toBeTruthy();
    expect(screen.getByTestId("icon-share")).toBeTruthy();
  });

  it("shares nothing until pressed", () => {
    renderWithProviders(<UserShare trail={TRAIL} />);
    expect(share).not.toHaveBeenCalled();
  });

  it("opens the share sheet with the trail's name and its link", async () => {
    renderWithProviders(<UserShare trail={TRAIL} />);
    fireEvent.press(screen.getByText("Dela"));
    await settle();

    expect(share).toHaveBeenCalledWith({ message: `Kronängsleden på Stigvidd: ${URL}` });
  });

  it("logs a share sheet that fails instead of rejecting", async () => {
    share.mockRejectedValue(new Error("no activity"));
    renderWithProviders(<UserShare trail={TRAIL} />);

    fireEvent.press(screen.getByText("Dela"));
    await settle();

    expect(logger.warn).toHaveBeenCalledWith("Sharing a trail failed", { errorMessage: "Error: no activity" });
  });

  it("links to the trail page on the share host", () => {
    expect(trailShareUrl(TRAIL.identifier)).toBe(URL);
  });

  it("escapes an identifier that is not URL-safe", () => {
    expect(trailShareUrl("a/b?c")).toBe("https://link.stigvidd.se/trail/a%2Fb%3Fc");
  });

  // A Pressable's style is a function of the press state, and pressing leaves no trace in the
  // tree — so the function is found on an ancestor of the label and called directly.
  it("dims while held", () => {
    renderWithProviders(<UserShare trail={TRAIL} />);

    type StyledNode = { props: { style?: unknown }; parent: StyledNode | null };
    let node = screen.getByText("Dela") as unknown as StyledNode | null;
    while (node && typeof node.props?.style !== "function") {
      node = node.parent;
    }
    if (!node) throw new Error("expected a pressable ancestor");
    const style = node.props.style as (state: { pressed: boolean }) => unknown[];

    expect(style({ pressed: true })).toContainEqual({ opacity: 0.7 });
    expect(style({ pressed: false })).not.toContainEqual({ opacity: 0.7 });
  });
});
