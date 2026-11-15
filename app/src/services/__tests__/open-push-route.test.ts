// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { logger } from "@/services/logger";
import type { NotificationHandler } from "@/services/notifications";
import { openPushRoute } from "@/services/open-push-route";

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args) } }));

const handler: NotificationHandler = {
  queryKeys: () => [],
  route: () => "/(tabs)/events/board/e1",
  routeBeneath: () => "/(tabs)/events/event/e1",
};

const mounted = { index: 0, routes: [{}] };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("warns when the screen beneath never lands, and still opens the target", async () => {
  const warn = jest.spyOn(logger, "warn");

  await openPushRoute(handler, {}, { currentPath: () => "/home", rootState: () => mounted });

  expect(warn).toHaveBeenCalledWith("Push route did not land", { path: "/events/event/e1", currentPath: "/home" });
  expect(mockNavigate).toHaveBeenLastCalledWith("/(tabs)/events/board/e1", { withAnchor: true });
});

it("stays quiet when the screen beneath lands", async () => {
  const warn = jest.spyOn(logger, "warn");

  await openPushRoute(handler, {}, { currentPath: () => "/events/event/e1", rootState: () => mounted });

  expect(warn).not.toHaveBeenCalled();
});
