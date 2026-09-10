// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The wire contract of every function here — path, method, token, error shape — is asserted
// from the table in endpoint-contract.test.ts. What is left is what that table cannot say:
// what each call hands back.

jest.mock("@/api/api-config", () => ({ BASE_URL: "http://test/api/v1" }));

jest.mock("@/api/users", () => ({ getUserToken: jest.fn() }));

jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { getUserToken } from "@/api/users";
import { CreateHikeRequest, Hike, ShareHikeRequest, UpdateHikeRequest } from "@/data/types";
import {
  createHike,
  deleteHike,
  getAllHikesByUserId,
  getHikeByIdentifier,
  hikeRouteQueryKey,
  shareHike,
  updateHike,
} from "../hikes";

const mockGetUserToken = getUserToken as jest.Mock;

function mockFetch(ok: boolean, body: unknown = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

const hike: Hike = {
  identifier: "abc-123",
  name: "Testpromenad",
  hikeLength: 5,
  duration: 3600,
  coordinates: '[{"latitude":59.3,"longitude":18.0}]',
  createdBy: "user-1",
  createdAt: "2026-08-04T10:00:00Z",
};

const createRequest: CreateHikeRequest = {
  name: "Testpromenad",
  hikeLength: 5,
  duration: 3600,
  coordinates: [
    { latitude: 59.3, longitude: 18.0 },
    { latitude: 59.4, longitude: 18.1 },
  ],
};

const updateRequest: UpdateHikeRequest = {
  hikeIdentifier: "abc-123",
  parkingInfo: "Vid vändplanen",
  gettingThere: "Buss 100",
  description: "Fin runda",
};

const shareRequest: ShareHikeRequest = {
  hikeIdentifier: "abc-123",
  sharedWithName: "stigvandraren",
  allowResharing: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserToken.mockResolvedValue("bearer-token");
});

describe("what each call returns", () => {
  it("createHike reports success rather than a body", async () => {
    mockFetch(true, { identifier: "abc-123" });
    await expect(createHike(createRequest)).resolves.toEqual({ success: true });
  });

  it("getHikeByIdentifier returns the parsed hike, coordinates and all", async () => {
    mockFetch(true, hike);
    await expect(getHikeByIdentifier("abc-123")).resolves.toEqual(hike);
  });

  it("updateHike returns the hike the server wrote, not the request", async () => {
    mockFetch(true, { ...hike, description: "Fin runda" });
    await expect(updateHike(updateRequest)).resolves.toEqual({ ...hike, description: "Fin runda" });
  });

  it("getAllHikesByUserId returns the list as sent", async () => {
    mockFetch(true, [hike]);
    await expect(getAllHikesByUserId("user-1")).resolves.toEqual([hike]);
  });

  it("shareHike reports success", async () => {
    mockFetch(true);
    await expect(shareHike(shareRequest)).resolves.toEqual({ success: true });
  });

  it("deleteHike reports success", async () => {
    mockFetch(true);
    await expect(deleteHike("abc-123")).resolves.toEqual({ success: true });
  });
});

describe("hikeRouteQueryKey", () => {
  it("scopes the cached route to a single hike", () => {
    expect(hikeRouteQueryKey("abc-123")).toEqual(["hike-route", "abc-123"]);
    expect(hikeRouteQueryKey("abc-123")).not.toEqual(hikeRouteQueryKey("def-456"));
  });
});
