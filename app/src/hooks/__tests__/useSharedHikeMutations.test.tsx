// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { useSharedHikeMutations } from "@/hooks/shared-hikes/useSharedHikeMutations";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";

const mockAccept = jest.fn();
const mockReject = jest.fn();

jest.mock("@/api/shared-hikes", () => ({
  acceptSharedHike: (...args: unknown[]) => mockAccept(...args),
  rejectSharedHike: (...args: unknown[]) => mockReject(...args),
}));

const MINE = ["shared-hikes", "u1"];
const INCOMING = ["shared-hikes", "incoming", "u1"];

type Mutations = ReturnType<typeof useSharedHikeMutations>;

function render() {
  let hook!: Mutations;
  function Probe() {
    hook = useSharedHikeMutations();
    return null;
  }

  const rendered = renderWithProviders(<Probe />);
  for (const key of [MINE, INCOMING]) {
    rendered.queryClient.setQueryDefaults(key, { gcTime: Infinity });
    rendered.queryClient.setQueryData(key, []);
  }

  return {
    ...rendered,
    run: async (name: keyof Mutations, arg: string) => {
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
});

describe("useSharedHikeMutations", () => {
  describe("accepting a shared hike", () => {
    it("accepts the hike it was given", async () => {
      const { run } = render();
      await run("acceptMutation", "h1");

      expect(mockAccept).toHaveBeenCalledWith("h1");
    });

    // Accepting moves a hike from the incoming list into the user's own.
    it("refreshes both the incoming list and the user's own", async () => {
      const { run, invalidated } = render();
      await run("acceptMutation", "h1");

      expect(invalidated(INCOMING)).toBe(true);
      expect(invalidated(MINE)).toBe(true);
    });

    it("confirms the hike was added", async () => {
      const { run, store } = render();
      await run("acceptMutation", "h1");

      expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success", message: "Promenaden tillagd!" });
    });

    it("reports a failure without touching the lists", async () => {
      mockAccept.mockRejectedValue(new Error("500"));
      const { run, store, invalidated } = render();
      await run("acceptMutation", "h1");

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Kunde inte godkänna, försök igen senare!",
      });
      expect(invalidated(MINE)).toBe(false);
    });
  });

  describe("rejecting a shared hike", () => {
    it("rejects the hike it was given", async () => {
      const { run } = render();
      await run("rejectMutation", "h1");

      expect(mockReject).toHaveBeenCalledWith("h1");
    });

    // A rejected hike is never added, so the user's own list is left as it is.
    it("refreshes the incoming list only", async () => {
      const { run, invalidated } = render();
      await run("rejectMutation", "h1");

      expect(invalidated(INCOMING)).toBe(true);
      expect(invalidated(MINE)).toBe(false);
    });

    it("confirms the rejection", async () => {
      const { run, store } = render();
      await run("rejectMutation", "h1");

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "success",
        message: "Promenaden har tagits bort",
      });
    });

    it("reports a failure", async () => {
      mockReject.mockRejectedValue(new Error("500"));
      const { run, store } = render();
      await run("rejectMutation", "h1");

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Något gick fel, försök igen senare!",
      });
    });
  });
});
