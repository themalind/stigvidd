// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Paths, methods, tokens and error shapes live in the table in endpoint-contract.test.ts.
// This file asserts what each call hands back.

jest.mock("@/api/api-config", () => ({ BASE_URL: "http://test/api/v1" }));

jest.mock("@/api/users", () => ({ getUserToken: jest.fn() }));

jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { getUserToken } from "@/api/users";
import { IncomingSharedHike, SharedHike } from "@/data/types";
import {
  acceptSharedHike,
  getIncomingSharedHike,
  getIncomingSharedHikes,
  getSharedHikes,
  rejectSharedHike,
  removeSharedHike,
  reshareHike,
} from "../shared-hikes";

const mockGetUserToken = getUserToken as jest.Mock;

function mockFetch(ok: boolean, body: unknown = []) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

const shared = { hikeIdentifier: "h1", hikeName: "Testpromenad" } as SharedHike;
const incoming = { hikeIdentifier: "h1", hikeName: "Testpromenad", sharedByName: "Anna" } as IncomingSharedHike;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserToken.mockResolvedValue("bearer-token");
});

describe("what each call returns", () => {
  it("getSharedHikes returns the list as sent", async () => {
    mockFetch(true, [shared]);
    await expect(getSharedHikes()).resolves.toEqual([shared]);
  });

  it("getIncomingSharedHikes returns the list as sent", async () => {
    mockFetch(true, [incoming]);
    await expect(getIncomingSharedHikes()).resolves.toEqual([incoming]);
  });

  it("getIncomingSharedHike returns the single hike as sent", async () => {
    mockFetch(true, shared);
    await expect(getIncomingSharedHike("h1")).resolves.toEqual(shared);
  });

  it.each([
    ["reshareHike", () => reshareHike({ hikeIdentifier: "h1", reShareToName: "stigvandraren" })],
    ["acceptSharedHike", () => acceptSharedHike("h1")],
    ["rejectSharedHike", () => rejectSharedHike("h1")],
    ["removeSharedHike", () => removeSharedHike("h1")],
  ])("%s reports success rather than a body", async (_name, call) => {
    mockFetch(true, { unexpected: true });
    await expect(call()).resolves.toEqual({ success: true });
  });
});
