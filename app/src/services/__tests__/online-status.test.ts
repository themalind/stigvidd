// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { MutationObserver, onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import { createQueryClient } from "@/api/query-client";
import { flushUntil } from "@/test/flush";
import { initOnlineStatus } from "../online-status";

const mockAddEventListener = NetInfo.addEventListener as jest.Mock;

function netInfoListener(): (state: Pick<NetInfoState, "isConnected">) => void {
  const listener = mockAddEventListener.mock.calls.at(-1)?.[0];
  if (!listener) throw new Error("expected a NetInfo listener");
  return listener;
}

let client: QueryClient;

beforeEach(() => {
  mockAddEventListener.mockClear();
  initOnlineStatus();
  client = createQueryClient();
  client.mount();
});

afterEach(() => {
  client.unmount();
  client.clear();
  onlineManager.setOnline(true);
});

it("tells React Query when the connection drops and comes back", () => {
  netInfoListener()({ isConnected: false });
  expect(onlineManager.isOnline()).toBe(false);

  netInfoListener()({ isConnected: true });
  expect(onlineManager.isOnline()).toBe(true);
});

it("treats an unknown connection state as online", () => {
  netInfoListener()({ isConnected: false });
  netInfoListener()({ isConnected: null });

  expect(onlineManager.isOnline()).toBe(true);
});

it("reloads a query that failed offline once the connection returns", async () => {
  const queryFn = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("trail");
  const observer = new QueryObserver(client, { queryKey: ["trail"], queryFn, retry: false });
  const unsubscribe = observer.subscribe(() => {});

  netInfoListener()({ isConnected: false });
  await client
    .getQueryCache()
    .find({ queryKey: ["trail"] })
    ?.promise?.catch(() => undefined);
  await Promise.resolve();
  expect(observer.getCurrentResult().isError).toBe(true);

  netInfoListener()({ isConnected: true });
  await flushUntil(() => observer.getCurrentResult().data === "trail");

  expect(queryFn).toHaveBeenCalledTimes(2);
  unsubscribe();
});

it("fails a save made offline instead of pausing it, so the form can say the hike is kept", async () => {
  netInfoListener()({ isConnected: false });
  const observer = new MutationObserver(client, { mutationFn: () => Promise.reject(new Error("offline")) });

  await expect(observer.mutate()).rejects.toThrow("offline");
  expect(observer.getCurrentResult().isError).toBe(true);
});
