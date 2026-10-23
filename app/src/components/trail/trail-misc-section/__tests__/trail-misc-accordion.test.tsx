// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailMiscInfo from "@/components/trail/trail-misc-section/trail-misc-accordion";
import { Trail, TrailLink } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

function trail(overrides: Partial<Trail> = {}): Trail {
  return { identifier: "trail-1", name: "Kvarnstigen", ...overrides } as Trail;
}

const VISITOR_INFO = { parking: "Finns på höga" } as Trail["visitorInformation"];
const LINKS: TrailLink[] = [{ identifier: "l1", link: "https://example.se", title: "Kommunen" }];

it("separates a single section from the guide row", () => {
  renderWithProviders(<TrailMiscInfo trail={trail({ visitorInformation: VISITOR_INFO })} onOpenGuide={jest.fn()} />);

  expect(screen.getByText("Praktisk information")).toBeTruthy();
  expect(screen.queryAllByTestId("trail-misc-divider")).toHaveLength(1);
});

it("draws a divider between sections and before the guide row", () => {
  renderWithProviders(
    <TrailMiscInfo
      trail={trail({ visitorInformation: VISITOR_INFO, fullDescription: "Lång text.", trailLinksResponse: LINKS })}
      onOpenGuide={jest.fn()}
    />,
  );

  expect(screen.queryAllByTestId("trail-misc-divider")).toHaveLength(3);
});

it("draws no extra divider when an earlier section is missing", () => {
  renderWithProviders(
    <TrailMiscInfo
      trail={trail({ fullDescription: "Lång text.", trailLinksResponse: LINKS })}
      onOpenGuide={jest.fn()}
    />,
  );

  expect(screen.queryAllByTestId("trail-misc-divider")).toHaveLength(2);
});

it("still offers the guide, without a divider, when the trail has none of the sections", () => {
  renderWithProviders(
    <TrailMiscInfo trail={trail({ visitorInformation: {} as Trail["visitorInformation"] })} onOpenGuide={jest.fn()} />,
  );

  expect(screen.getByTestId("trail-misc-guide")).toBeTruthy();
  expect(screen.queryByText("Praktisk information")).toBeNull();
  expect(screen.queryAllByTestId("trail-misc-divider")).toHaveLength(0);
});

it("opens the guide when its row is pressed", () => {
  const onOpenGuide = jest.fn();
  renderWithProviders(<TrailMiscInfo trail={trail()} onOpenGuide={onOpenGuide} />);

  expect(screen.getByText("Naturguide")).toBeTruthy();
  expect(screen.getByText("Allemansrätten och naturreservat")).toBeTruthy();
  fireEvent.press(screen.getByTestId("trail-misc-guide"));

  expect(onOpenGuide).toHaveBeenCalledTimes(1);
});
