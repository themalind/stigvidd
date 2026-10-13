// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { useFriendMutations } from "@/hooks/friends/useFriendMutations";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";

const mockAccept = jest.fn();
const mockReject = jest.fn();
const mockSend = jest.fn();
const mockRemove = jest.fn();

jest.mock("@/api/friends", () => ({
  acceptFriendRequest: (...args: unknown[]) => mockAccept(...args),
  rejectFriendRequest: (...args: unknown[]) => mockReject(...args),
  sendFriendRequest: (...args: unknown[]) => mockSend(...args),
  removeFriend: (...args: unknown[]) => mockRemove(...args),
}));

const FRIENDS = ["friends", "u1"];
const INCOMING = ["friends", "incoming", "u1"];
const OUTGOING = ["friends", "outgoing"];

type Mutations = ReturnType<typeof useFriendMutations>;
type MutationName = keyof Mutations;

function render() {
  let hook!: Mutations;
  function Probe() {
    hook = useFriendMutations();
    return null;
  }

  const rendered = renderWithProviders(<Probe />);
  // The lists are seeded without an observer, and renderWithProviders sets gcTime 0.
  for (const key of [FRIENDS, INCOMING, OUTGOING]) {
    rendered.queryClient.setQueryDefaults(key, { gcTime: Infinity });
    rendered.queryClient.setQueryData(key, []);
  }

  return {
    ...rendered,
    run: async (name: MutationName, arg: string) => {
      act(() => hook[name].mutate(arg));
      await flushUntil(() => hook[name].isError || hook[name].isSuccess);
    },
    invalidated: (key: unknown[]) => rendered.queryClient.getQueryState(key)?.isInvalidated === true,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccept.mockResolvedValue({ success: true });
  mockReject.mockResolvedValue({ success: true });
  mockSend.mockResolvedValue({ success: true });
  mockRemove.mockResolvedValue({ success: true });
});

describe("useFriendMutations", () => {
  describe("accepting a request", () => {
    it("accepts the request it was given", async () => {
      const { run } = render();
      await run("acceptMutation", "them");

      expect(mockAccept).toHaveBeenCalledWith("them");
    });

    it("refreshes both the incoming requests and the friend list", async () => {
      const { run, invalidated } = render();
      await run("acceptMutation", "them");

      expect(invalidated(INCOMING)).toBe(true);
      expect(invalidated(FRIENDS)).toBe(true);
    });

    it("confirms the acceptance", async () => {
      const { run, store } = render();
      await run("acceptMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "success",
        message: "Förfrågan accepterad!",
      });
    });

    it("reports a failure without touching the lists", async () => {
      mockAccept.mockRejectedValue(new Error("500"));
      const { run, store, invalidated } = render();
      await run("acceptMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Kunde inte godkänna, försök igen senare!",
      });
      expect(invalidated(FRIENDS)).toBe(false);
    });

    it("drops a request that is no longer open instead of inviting a retry", async () => {
      mockAccept.mockRejectedValue(new ApiError("HTTP error: acceptFriendRequest: 404", 404));
      const { run, store, invalidated } = render();
      await run("acceptMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "warning",
        message: "Förfrågan är inte längre aktuell.",
      });
      expect(invalidated(INCOMING)).toBe(true);
      expect(invalidated(FRIENDS)).toBe(true);
    });

    it("still reports a server error as one", async () => {
      mockAccept.mockRejectedValue(new ApiError("HTTP error: acceptFriendRequest: 500", 500));
      const { run, store, invalidated } = render();
      await run("acceptMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({
        type: "error",
        message: "Kunde inte godkänna, försök igen senare!",
      });
      expect(invalidated(INCOMING)).toBe(false);
    });
  });

  describe("rejecting a request", () => {
    it("rejects the request it was given", async () => {
      const { run } = render();
      await run("rejectMutation", "them");

      expect(mockReject).toHaveBeenCalledWith("them");
    });

    // A rejection adds nobody, so the friend list is left as it is.
    it("refreshes the incoming requests only", async () => {
      const { run, invalidated } = render();
      await run("rejectMutation", "them");

      expect(invalidated(INCOMING)).toBe(true);
      expect(invalidated(FRIENDS)).toBe(false);
    });

    it("confirms the rejection", async () => {
      const { run, store } = render();
      await run("rejectMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success", message: "Förfrågan nekad" });
    });

    it("reports a failure", async () => {
      mockReject.mockRejectedValue(new Error("500"));
      const { run, store } = render();
      await run("rejectMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Något gick fel, försök igen senare!",
      });
    });

    it("counts a request that is already gone as declined", async () => {
      mockReject.mockRejectedValue(new ApiError("HTTP error: rejectFriendRequest: 404", 404));
      const { run, store, invalidated } = render();
      await run("rejectMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success", message: "Förfrågan nekad" });
      expect(invalidated(INCOMING)).toBe(true);
    });
  });

  describe("sending a request", () => {
    it("sends to the nickname it was given", async () => {
      const { run } = render();
      await run("sendRequestMutation", "stigvandraren");

      expect(mockSend).toHaveBeenCalledWith("stigvandraren");
    });

    it("refreshes the outgoing requests only", async () => {
      const { run, invalidated } = render();
      await run("sendRequestMutation", "stigvandraren");

      expect(invalidated(OUTGOING)).toBe(true);
      expect(invalidated(INCOMING)).toBe(false);
      expect(invalidated(FRIENDS)).toBe(false);
    });

    it("confirms the request was sent", async () => {
      const { run, store } = render();
      await run("sendRequestMutation", "stigvandraren");

      expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success", message: "Förfrågan skickad!" });
    });

    it("reports a failure", async () => {
      mockSend.mockRejectedValue(new Error("409"));
      const { run, store } = render();
      await run("sendRequestMutation", "stigvandraren");

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Kunde inte skicka förfrågan, försök igen!",
      });
    });
  });

  describe("removing a friend", () => {
    it("removes the friend it was given", async () => {
      const { run } = render();
      await run("removeFriendMutation", "them");

      expect(mockRemove).toHaveBeenCalledWith("them");
    });

    it("refreshes the friend list", async () => {
      const { run, invalidated } = render();
      await run("removeFriendMutation", "them");

      expect(invalidated(FRIENDS)).toBe(true);
    });

    it("confirms the removal", async () => {
      const { run, store } = render();
      await run("removeFriendMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success", message: "Vän borttagen" });
    });

    it("reports a failure", async () => {
      mockRemove.mockRejectedValue(new Error("500"));
      const { run, store } = render();
      await run("removeFriendMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Kunde inte ta bort vän, försök igen senare!",
      });
    });

    it("refreshes rather than fails when the connection is already gone", async () => {
      mockRemove.mockRejectedValue(new ApiError("HTTP error: removeFriend: 404", 404));
      const { run, store, invalidated } = render();
      await run("removeFriendMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({ type: "warning", message: "Förfrågan är inte längre aktuell." });
      expect(invalidated(FRIENDS)).toBe(true);
    });
  });

  describe("withdrawing a sent request", () => {
    it("withdraws the request to the receiver it was given", async () => {
      const { run } = render();
      await run("withdrawRequestMutation", "them");

      expect(mockRemove).toHaveBeenCalledWith("them");
    });

    it("refreshes the outgoing requests and says the request was withdrawn", async () => {
      const { run, store, invalidated } = render();
      await run("withdrawRequestMutation", "them");

      expect(invalidated(OUTGOING)).toBe(true);
      expect(invalidated(FRIENDS)).toBe(false);
      expect(store.get(snackbarAtom)).toMatchObject({ type: "success", message: "Förfrågan tillbakadragen" });
    });

    it("refreshes rather than fails when the receiver already answered", async () => {
      mockRemove.mockRejectedValue(new ApiError("HTTP error: removeFriend: 404", 404));
      const { run, store, invalidated } = render();
      await run("withdrawRequestMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({ type: "warning", message: "Förfrågan är inte längre aktuell." });
      expect(invalidated(OUTGOING)).toBe(true);
    });

    it("reports any other failure", async () => {
      mockRemove.mockRejectedValue(new ApiError("HTTP error: removeFriend: 500", 500));
      const { run, store } = render();
      await run("withdrawRequestMutation", "them");

      expect(store.get(snackbarAtom)).toMatchObject({
        type: "error",
        message: "Kunde inte dra tillbaka förfrågan, försök igen!",
      });
    });
  });
});
