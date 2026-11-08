// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { useEventMutations } from "@/hooks/events/useEventMutations";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";

const mockJoin = jest.fn();
const mockLeave = jest.fn();
const mockMarkInterested = jest.fn();
const mockUnmarkInterested = jest.fn();
const mockAccept = jest.fn();
const mockDecline = jest.fn();

jest.mock("@/api/events", () => ({
  joinEvent: (...args: unknown[]) => mockJoin(...args),
  leaveEvent: (...args: unknown[]) => mockLeave(...args),
  markEventInterested: (...args: unknown[]) => mockMarkInterested(...args),
  unmarkEventInterested: (...args: unknown[]) => mockUnmarkInterested(...args),
  acceptEventInvitation: (...args: unknown[]) => mockAccept(...args),
  declineEventInvitation: (...args: unknown[]) => mockDecline(...args),
}));

const DETAIL = ["events", "detail", "e1"];
const INVITATIONS = ["events", "invitations", "u1"];

type Mutations = ReturnType<typeof useEventMutations>;
type SimpleMutation = "joinMutation" | "leaveMutation" | "acceptInvitationMutation" | "declineInvitationMutation";

async function render() {
  let hook: Mutations | undefined;
  function Probe() {
    hook = useEventMutations();
    return null;
  }

  const current = () => {
    if (!hook) throw new Error("expected the hook to have rendered");
    return hook;
  };

  const rendered = await renderWithProviders(<Probe />);
  // Seeded without an observer, and renderWithProviders sets gcTime 0. keep-comment: why gcTime is raised
  for (const key of [DETAIL, INVITATIONS]) {
    rendered.queryClient.setQueryDefaults(key, { gcTime: Infinity });
    rendered.queryClient.setQueryData(key, {});
  }

  return {
    ...rendered,
    run: async (name: SimpleMutation, arg: string) => {
      await act(() => current()[name].mutate(arg));
      await flushUntil(() => current()[name].isError || current()[name].isSuccess);
    },
    setInterested: async (interested: boolean) => {
      await act(() => current().interestedMutation.mutate({ identifier: "e1", interested }));
      await flushUntil(() => current().interestedMutation.isError || current().interestedMutation.isSuccess);
    },
    invalidated: (key: unknown[]) => rendered.queryClient.getQueryState(key)?.isInvalidated === true,
  };
}

function coded(status: number, code: string) {
  return new ApiError(`HTTP error: ${status}`, status, code);
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const mock of [mockJoin, mockLeave, mockMarkInterested, mockUnmarkInterested, mockAccept, mockDecline]) {
    mock.mockResolvedValue(undefined);
  }
});

describe("useEventMutations", () => {
  it("joins and refreshes every event query", async () => {
    const { run, store, invalidated } = await render();
    await run("joinMutation", "e1");

    expect(mockJoin).toHaveBeenCalledWith("e1");
    expect(invalidated(DETAIL)).toBe(true);
    expect(invalidated(INVITATIONS)).toBe(true);
    expect(store.get(snackbarAtom)).toMatchObject({ type: "success", message: "Du är med!" });
  });

  it("names a full event as the reason a join failed, and redraws", async () => {
    mockJoin.mockRejectedValue(coded(409, "event_full"));
    const { run, store, invalidated } = await render();
    await run("joinMutation", "e1");

    expect(store.get(snackbarAtom)).toMatchObject({ type: "warning", message: "Evenemanget är fullt." });
    expect(invalidated(DETAIL)).toBe(true);
  });

  it.each(["removed_from_event", "event_gone"])("gives a join refused with %s no reason", async (code) => {
    mockJoin.mockRejectedValue(coded(409, code));
    const { run, store } = await render();
    await run("joinMutation", "e1");

    expect(store.get(snackbarAtom)).toMatchObject({
      type: "warning",
      message: "Du kan inte gå med i det här evenemanget.",
    });
  });

  it("names a revoked invitation when accepting", async () => {
    mockAccept.mockRejectedValue(coded(404, "invitation_gone"));
    const { run, store, invalidated } = await render();
    await run("acceptInvitationMutation", "e1");

    expect(store.get(snackbarAtom)).toMatchObject({ type: "warning", message: "Inbjudan är inte längre aktuell." });
    expect(invalidated(INVITATIONS)).toBe(true);
  });

  it("falls back to a generic error when the failure has no known code", async () => {
    mockLeave.mockRejectedValue(new ApiError("HTTP error: 500", 500));
    const { run, store } = await render();
    await run("leaveMutation", "e1");

    expect(store.get(snackbarAtom)).toMatchObject({ type: "error", message: "Något gick fel. Försök igen." });
  });

  it("declines and refreshes the invitations", async () => {
    const { run, store, invalidated } = await render();
    await run("declineInvitationMutation", "e1");

    expect(mockDecline).toHaveBeenCalledWith("e1");
    expect(invalidated(INVITATIONS)).toBe(true);
    expect(store.get(snackbarAtom)).toMatchObject({ type: "success", message: "Inbjudan avböjd" });
  });

  it.each(["leaveMutation", "declineInvitationMutation"] as const)(
    "%s on a private event refreshes the lists but not the event it can no longer read",
    async (name) => {
      const { run, queryClient, invalidated } = await render();
      queryClient.setQueryData(DETAIL, { visibility: "Private" });
      await run(name, "e1");

      expect(invalidated(DETAIL)).toBe(false);
      expect(invalidated(INVITATIONS)).toBe(true);
    },
  );

  it.each(["leaveMutation", "declineInvitationMutation"] as const)(
    "%s on an open event refreshes the event too",
    async (name) => {
      const { run, queryClient, invalidated } = await render();
      queryClient.setQueryData(DETAIL, { visibility: "Public" });
      await run(name, "e1");

      expect(invalidated(DETAIL)).toBe(true);
    },
  );

  it("marks and unmarks interest through the matching endpoint", async () => {
    const { setInterested } = await render();
    await setInterested(true);
    await setInterested(false);

    expect(mockMarkInterested).toHaveBeenCalledWith("e1");
    expect(mockUnmarkInterested).toHaveBeenCalledWith("e1");
  });
});
