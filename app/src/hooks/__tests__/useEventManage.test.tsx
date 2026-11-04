// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useEventManageMutations } from "@/hooks/events/useEventManage";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { useQuery } from "@tanstack/react-query";

const mockDeleteEvent = jest.fn();

jest.mock("@/api/events", () => ({
  ...jest.requireActual("@/api/events"),
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
}));

function renderManage(identifier: string) {
  const fetchDetail = jest.fn().mockResolvedValue({ identifier });
  const fetchParticipants = jest.fn().mockResolvedValue({ participants: [] });
  const fetchFeed = jest.fn().mockResolvedValue({ items: [] });
  let manage: ReturnType<typeof useEventManageMutations> | undefined;

  function Probe() {
    useQuery({ queryKey: ["events", "detail", identifier, "me"], queryFn: fetchDetail });
    useQuery({ queryKey: ["events", "participants", identifier, "me"], queryFn: fetchParticipants });
    useQuery({ queryKey: ["events", "feed", "me"], queryFn: fetchFeed });
    manage = useEventManageMutations(identifier);
    return null;
  }

  renderWithProviders(<Probe />);
  return {
    fetchDetail,
    fetchParticipants,
    fetchFeed,
    manage: () => {
      if (!manage) throw new Error("expected the hook to have rendered");
      return manage;
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("deleting an event", () => {
  it("refreshes the lists without refetching the deleted event", async () => {
    mockDeleteEvent.mockResolvedValue(undefined);
    const harness = renderManage("ev-1");
    await flushUntil(() => harness.fetchFeed.mock.calls.length === 1 && harness.fetchDetail.mock.calls.length === 1);

    await harness.manage().deleteMutation.mutateAsync();
    await flushUntil(() => harness.fetchFeed.mock.calls.length === 2);

    expect(harness.fetchDetail).toHaveBeenCalledTimes(1);
    expect(harness.fetchParticipants).toHaveBeenCalledTimes(1);
  });
});
