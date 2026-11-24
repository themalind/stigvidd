// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/core/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { useEventManageMutations } from "@/hooks/events/useEventManage";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { useQuery } from "@tanstack/react-query";

const mockDeleteEvent = jest.fn();
const mockCancelEvent = jest.fn();
const mockInviteToEvent = jest.fn();
const mockSetRole = jest.fn();

jest.mock("@/api/events", () => ({
  ...jest.requireActual("@/api/events"),
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
  cancelEvent: (...args: unknown[]) => mockCancelEvent(...args),
  inviteToEvent: (...args: unknown[]) => mockInviteToEvent(...args),
  setEventParticipantRole: (...args: unknown[]) => mockSetRole(...args),
}));

async function renderManage(identifier: string) {
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

  const { store } = await renderWithProviders(<Probe />);
  await flushUntil(() => fetchFeed.mock.calls.length === 1 && fetchDetail.mock.calls.length === 1);
  return {
    store,
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
    const harness = await renderManage("ev-1");

    await harness.manage().deleteMutation.mutateAsync();
    await flushUntil(() => harness.fetchFeed.mock.calls.length === 2);

    expect(harness.fetchFeed).toHaveBeenCalledTimes(2);
    expect(harness.fetchDetail).toHaveBeenCalledTimes(1);
    expect(harness.fetchParticipants).toHaveBeenCalledTimes(1);
  });
});

describe("cancelling an event", () => {
  it("refreshes the lists and says the event is cancelled", async () => {
    mockCancelEvent.mockResolvedValue(undefined);
    const harness = await renderManage("ev-1");

    await harness.manage().cancelMutation.mutateAsync();
    await flushUntil(() => harness.fetchFeed.mock.calls.length === 2);

    expect(mockCancelEvent).toHaveBeenCalledWith("ev-1");
    expect(harness.fetchFeed).toHaveBeenCalledTimes(2);
    expect(harness.store.get(snackbarAtom)).toMatchObject({
      visible: true,
      type: "success",
      message: "Evenemanget är inställt",
    });
  });
});

describe("changing a participant's role", () => {
  it("refreshes who is in the event, not the lists", async () => {
    mockSetRole.mockResolvedValue(undefined);
    const harness = await renderManage("ev-1");

    await harness.manage().setRoleMutation.mutateAsync({ userIdentifier: "u-2", role: "CoHost" });
    await flushUntil(() => harness.fetchParticipants.mock.calls.length === 2);

    expect(mockSetRole).toHaveBeenCalledWith("ev-1", "u-2", "CoHost");
    expect(harness.fetchParticipants).toHaveBeenCalledTimes(2);
    expect(harness.fetchDetail).toHaveBeenCalledTimes(2);
    expect(harness.fetchFeed).toHaveBeenCalledTimes(1);
  });
});

describe("inviting", () => {
  it("counts the invitations sent and refreshes who is in the event", async () => {
    mockInviteToEvent.mockResolvedValue(undefined);
    const harness = await renderManage("ev-1");

    await harness.manage().inviteMutation.mutateAsync(["anna", "bertil"]);
    await flushUntil(() => harness.fetchParticipants.mock.calls.length === 2);

    expect(harness.fetchParticipants).toHaveBeenCalledTimes(2);
    expect(harness.store.get(snackbarAtom)).toMatchObject({
      type: "success",
      message: "2 inbjudningar skickade",
    });
    expect(harness.manage().unknownNickNames).toEqual([]);
  });

  it("names the nicknames that no longer exist, so the rest can be sent again", async () => {
    mockInviteToEvent.mockRejectedValue(
      new ApiError("invite failed", 404, "unknown_nicknames", { code: "unknown_nicknames", nickNames: ["borta"] }),
    );
    const harness = await renderManage("ev-1");

    await expect(harness.manage().inviteMutation.mutateAsync(["anna", "borta"])).rejects.toThrow();
    await flushUntil(() => harness.manage().unknownNickNames.length === 1);

    expect(harness.manage().unknownNickNames).toEqual(["borta"]);
    expect(harness.store.get(snackbarAtom)).toMatchObject({
      type: "warning",
      message: "borta finns inte längre. Övriga kan bjudas in igen.",
    });
    expect(harness.fetchParticipants).toHaveBeenCalledTimes(1);
  });

  it("treats any other failure as an event error, not as gone nicknames", async () => {
    mockInviteToEvent.mockRejectedValue(new ApiError("invite failed", 500));
    const harness = await renderManage("ev-1");

    await expect(harness.manage().inviteMutation.mutateAsync(["anna"])).rejects.toThrow();
    await flushUntil(() => harness.store.get(snackbarAtom).visible);

    expect(harness.manage().unknownNickNames).toEqual([]);
    expect(harness.store.get(snackbarAtom)).toMatchObject({ type: "error", message: "Något gick fel. Försök igen." });
  });
});
