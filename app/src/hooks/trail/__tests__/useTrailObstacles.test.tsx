// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { userAtom } from "@/atoms/auth-atoms";
import { TRAIL_DETAIL_STALE_TIME } from "@/constants/cache";
import { useTrailObstacles } from "@/hooks/trail/useTrailObstacles";
import { flushUntil } from "@/test/flush";
import { staleTimeOf } from "@/test/query";
import { renderWithProviders } from "@/test/render";
import { act, screen } from "@testing-library/react-native";
import { Text } from "react-native";

const mockGetObstacles = jest.fn();
const SIGNED_IN = { id: "u1", email: "a@b.se", username: "jag" };

jest.mock("@/api/trail-obstacles", () => ({
  getTrailObstaclesByTrailIdentifier: (...args: unknown[]) => mockGetObstacles(...args),
}));

function Probe({ identifier }: { identifier: string | undefined }) {
  const { data } = useTrailObstacles(identifier);
  return <Text testID="probe">{data ? data.map((o) => o.identifier).join(",") : "none"}</Text>;
}

function shown() {
  return screen.getByTestId("probe").props.children as string;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetObstacles.mockResolvedValue([{ identifier: "o1" }]);
});

it("loads the trail's obstacles", async () => {
  await renderWithProviders(<Probe identifier="trail-1" />);
  await flushUntil(() => shown() === "o1");

  expect(mockGetObstacles).toHaveBeenCalledWith("trail-1");
});

it("asks for nothing without a trail", async () => {
  await renderWithProviders(<Probe identifier={undefined} />);

  expect(mockGetObstacles).not.toHaveBeenCalled();
  expect(shown()).toBe("none");
});

// keep-comment: a vote, edit or delete invalidates ["obstacles", trail]; both screens must refetch on it
it("refetches when the trail's obstacles are invalidated", async () => {
  const { queryClient } = await renderWithProviders(<Probe identifier="trail-1" />);
  await flushUntil(() => shown() === "o1");
  mockGetObstacles.mockResolvedValue([]);

  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ["obstacles", "trail-1"] });
  });
  await flushUntil(() => shown() === "");

  expect(mockGetObstacles).toHaveBeenCalledTimes(2);
});

it("keeps showing the trail's obstacles while a sign-in refetches them", async () => {
  const { store } = await renderWithProviders(<Probe identifier="trail-1" />);
  await flushUntil(() => shown() === "o1");
  mockGetObstacles.mockReturnValue(new Promise(() => {}));

  await act(async () => {
    store.set(userAtom, SIGNED_IN);
  });

  expect(mockGetObstacles).toHaveBeenCalledTimes(2);
  expect(shown()).toBe("o1");
});

it("never shows one trail's obstacles while another trail's load", async () => {
  const { rerender } = await renderWithProviders(<Probe identifier="trail-1" />);
  await flushUntil(() => shown() === "o1");
  mockGetObstacles.mockReturnValue(new Promise(() => {}));

  await rerender(<Probe identifier="trail-2" />);

  expect(shown()).toBe("none");
});

it("keeps the obstacles as long as the trail's other details", async () => {
  const { queryClient } = await renderWithProviders(<Probe identifier="trail-1" />);
  await flushUntil(() => shown() === "o1");

  expect(staleTimeOf(queryClient, ["obstacles", "trail-1", undefined])).toBe(TRAIL_DETAIL_STALE_TIME);
});
