// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Every function in src/api is the same shape — token, fetch, !ok -> throw, log, rethrow —
// so the wire contract of all of them is asserted from one table here. Behaviour that is
// specific to an endpoint (pagination, multipart bodies) stays in the per-module suites.

jest.mock("@/api/api-config", () => ({ BASE_URL: "http://test/api/v1" }));

jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

// The single source of every bearer token: mocking it here rather than mocking @/api/users
// keeps users.ts itself under test.
jest.mock("@/services/keycloak-auth", () => ({ getValidAccessToken: jest.fn() }));

import { getValidAccessToken } from "@/services/keycloak-auth";
import { ApiError } from "../api-error";
import { getAreaByIdentifier, getAreas } from "../areas";
import {
  acceptFriendRequest,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
} from "../friends";
import { createHike, deleteHike, getAllHikesByUserId, getHikeByIdentifier, shareHike, updateHike } from "../hikes";
import { getFacilityMarkers, getTrailMarkers } from "../map-markers";
import { registerPushToken, unregisterPushToken } from "../notifications";
import { createReview, deleteReview, getReviewsByTrailIdentifier, hasReviewedTrail } from "../reviews";
import {
  acceptSharedHike,
  getIncomingSharedHike,
  getIncomingSharedHikes,
  getSharedHikes,
  rejectSharedHike,
  removeSharedHike,
  reshareHike,
} from "../shared-hikes";
import {
  addSolvedVote,
  createTrailObstacle,
  deleteSolvedVote,
  deleteTrailObstacle,
  getObstacleIssueTypes,
  getTrailObstaclesByTrailIdentifier,
  updateTrailObstacle,
} from "../trail-obstacles";
import {
  getAllTrails,
  getCoordinatesByTrailIdentifier,
  getPopularTrails,
  getTrailByIdentifier,
  getTrailCard,
  getTrailCards,
} from "../trails";
import {
  addToUserFavorite,
  addToUserWishlist,
  deleteStigViddUser,
  getStigViddUser,
  getUserFavorites,
  getUserWishlist,
  removeUserFavorite,
  removeUserWishlist,
} from "../users";

const BASE = "http://test/api/v1";
const mockToken = getValidAccessToken as jest.Mock;

function mockFetch(ok: boolean, status = ok ? 200 : 500, body: unknown = {}) {
  const fn = jest.fn().mockResolvedValue({
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

// How an endpoint treats a missing token:
//  - "required"  refuses to call the network at all
//  - "none"      is public and sends no Authorization header
type Auth = "required" | "none";

interface Endpoint {
  name: string;
  call: () => Promise<unknown>;
  method: string;
  path: string;
  auth: Auth;
  // What a non-2xx response throws. The public GETs on trails/ and map-markers throw a
  // plain Error, so the status is lost; the rest carry it on an ApiError.
  carriesStatus: boolean;
  body?: unknown;
}

const obstacleRequest = {
  description: "Nedfallet träd",
  issueType: "Hinder",
  trailIdentifier: "t1",
  incidentLongitude: 12.94,
  incidentLatitude: 57.72,
};

const createHikeRequest = {
  name: "Testpromenad",
  hikeLength: 5,
  duration: 3600,
  coordinates: [{ latitude: 57.72, longitude: 12.94 }],
};

const updateHikeRequest = {
  hikeIdentifier: "h1",
  parkingInfo: "Vid vandplanen",
  gettingThere: "Buss 100",
  description: "Fin runda",
};

const shareHikeRequest = { hikeIdentifier: "h1", sharedWithName: "stigvandraren", allowResharing: true };

const reshareRequest = { hikeIdentifier: "h1", reShareToName: "stigvandraren" };

const endpoints: Endpoint[] = [
  // areas
  { name: "getAreas", call: () => getAreas(), method: "GET", path: "/cityareas", auth: "none", carriesStatus: true },
  {
    name: "getAreaByIdentifier",
    call: () => getAreaByIdentifier("a1"),
    method: "GET",
    path: "/cityareas/a1",
    auth: "none",
    carriesStatus: true,
  },

  // map markers
  {
    name: "getTrailMarkers",
    call: () => getTrailMarkers(),
    method: "GET",
    path: "/trails/markers",
    auth: "none",
    carriesStatus: false,
  },
  {
    name: "getFacilityMarkers",
    call: () => getFacilityMarkers(),
    method: "GET",
    path: "/facilities",
    auth: "none",
    carriesStatus: false,
  },

  // notifications
  {
    name: "registerPushToken",
    call: () => registerPushToken("ExponentPushToken[abc]", "ios"),
    method: "POST",
    path: "/notifications/tokens",
    auth: "required",
    carriesStatus: true,
    body: { expoToken: "ExponentPushToken[abc]", platform: "ios" },
  },
  {
    name: "unregisterPushToken",
    call: () => unregisterPushToken("ExponentPushToken[abc]"),
    method: "DELETE",
    path: "/notifications/tokens/ExponentPushToken%5Babc%5D",
    auth: "required",
    carriesStatus: true,
  },

  // reviews
  {
    name: "getReviewsByTrailIdentifier",
    call: () => getReviewsByTrailIdentifier("t1", 2, 5),
    method: "GET",
    path: "/reviews/trail/t1?page=2&limit=5",
    auth: "none",
    carriesStatus: true,
  },
  {
    name: "hasReviewedTrail",
    call: () => hasReviewedTrail("t1"),
    method: "GET",
    path: "/reviews/trail/t1/mine",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "createReview",
    call: () => createReview({ trailIdentifier: "t1", review: "Fin led", rating: 4 }),
    method: "POST",
    path: "/reviews/create",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "deleteReview",
    call: () => deleteReview("r1"),
    method: "DELETE",
    path: "/reviews/r1",
    auth: "required",
    carriesStatus: true,
  },

  // trail obstacles
  {
    name: "getTrailObstaclesByTrailIdentifier",
    call: () => getTrailObstaclesByTrailIdentifier("t1"),
    method: "GET",
    path: "/trailobstacles/trail/t1",
    auth: "none",
    carriesStatus: true,
  },
  {
    name: "addSolvedVote",
    call: () => addSolvedVote("o1"),
    method: "POST",
    path: "/trailobstacles/solve/o1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "deleteSolvedVote",
    call: () => deleteSolvedVote("o1"),
    method: "DELETE",
    path: "/trailobstacles/solve/o1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "createTrailObstacle",
    call: () => createTrailObstacle(obstacleRequest),
    method: "POST",
    path: "/trailobstacles",
    auth: "required",
    carriesStatus: true,
    body: obstacleRequest,
  },
  {
    name: "updateTrailObstacle",
    call: () => updateTrailObstacle("o1", { description: "Röjt", issueType: "Hinder" }),
    method: "PUT",
    path: "/trailobstacles/o1",
    auth: "required",
    carriesStatus: true,
    body: { description: "Röjt", issueType: "Hinder" },
  },
  {
    name: "getObstacleIssueTypes",
    call: () => getObstacleIssueTypes(),
    method: "GET",
    path: "/trailobstacles/issue-types",
    auth: "none",
    carriesStatus: true,
  },
  {
    name: "deleteTrailObstacle",
    call: () => deleteTrailObstacle("o1"),
    method: "DELETE",
    path: "/trailobstacles/o1",
    auth: "required",
    carriesStatus: true,
  },

  // users
  {
    name: "getStigViddUser",
    call: () => getStigViddUser(),
    method: "GET",
    path: "/users",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "getUserFavorites",
    call: () => getUserFavorites(),
    method: "GET",
    path: "/users/favorites",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "getUserWishlist",
    call: () => getUserWishlist(),
    method: "GET",
    path: "/users/wishlist",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "addToUserFavorite",
    call: () => addToUserFavorite("t1"),
    method: "POST",
    path: "/users/favorites",
    auth: "required",
    carriesStatus: true,
    body: { trailIdentifier: "t1" },
  },
  {
    name: "addToUserWishlist",
    call: () => addToUserWishlist("t1"),
    method: "POST",
    path: "/users/wishlist",
    auth: "required",
    carriesStatus: true,
    body: { trailIdentifier: "t1" },
  },
  {
    name: "removeUserFavorite",
    call: () => removeUserFavorite("t1"),
    method: "DELETE",
    path: "/users/favorites/t1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "removeUserWishlist",
    call: () => removeUserWishlist("t1"),
    method: "DELETE",
    path: "/users/wishlist/t1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "deleteStigViddUser",
    call: () => deleteStigViddUser(),
    method: "DELETE",
    path: "/users/delete",
    auth: "required",
    carriesStatus: true,
  },

  // trails
  {
    name: "getPopularTrails",
    call: () => getPopularTrails(),
    method: "GET",
    path: "/trails/popular",
    auth: "none",
    carriesStatus: false,
  },
  {
    name: "getAllTrails",
    call: () => getAllTrails(),
    method: "GET",
    path: "/trails",
    auth: "none",
    carriesStatus: false,
  },
  {
    name: "getTrailByIdentifier",
    call: () => getTrailByIdentifier("t1"),
    method: "GET",
    path: "/trails/t1",
    auth: "none",
    carriesStatus: false,
  },
  {
    name: "getTrailCard",
    call: () => getTrailCard("t1"),
    method: "GET",
    path: "/trails/t1/card",
    auth: "none",
    carriesStatus: false,
  },
  {
    name: "getTrailCards",
    call: () => getTrailCards(["a", "b"]),
    method: "POST",
    path: "/trails/cards",
    auth: "none",
    carriesStatus: false,
    body: { identifiers: ["a", "b"] },
  },
  {
    name: "getCoordinatesByTrailIdentifier",
    call: () => getCoordinatesByTrailIdentifier("t1"),
    method: "GET",
    path: "/trails/t1/coordinates",
    auth: "none",
    carriesStatus: false,
  },

  // hikes
  {
    name: "createHike",
    call: () => createHike(createHikeRequest),
    method: "POST",
    path: "/hikes",
    auth: "required",
    carriesStatus: true,
    // The coordinate array travels as a JSON string, not as nested JSON.
    body: { ...createHikeRequest, coordinates: JSON.stringify(createHikeRequest.coordinates) },
  },
  {
    name: "updateHike",
    call: () => updateHike(updateHikeRequest),
    method: "PUT",
    path: "/hikes/h1",
    auth: "required",
    carriesStatus: true,
    body: updateHikeRequest,
  },
  {
    name: "getHikeByIdentifier",
    call: () => getHikeByIdentifier("h1"),
    method: "GET",
    path: "/hikes/h1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "getAllHikesByUserId",
    call: () => getAllHikesByUserId("u1"),
    method: "GET",
    path: "/hikes?createdBy=u1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "shareHike",
    call: () => shareHike(shareHikeRequest),
    method: "POST",
    path: "/hikeshares/share",
    auth: "required",
    carriesStatus: true,
    body: shareHikeRequest,
  },
  {
    name: "deleteHike",
    call: () => deleteHike("h1"),
    method: "DELETE",
    path: "/hikes/h1",
    auth: "required",
    carriesStatus: true,
  },

  // shared hikes
  {
    name: "getSharedHikes",
    call: () => getSharedHikes(),
    method: "GET",
    path: "/hikesharerecipient",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "getIncomingSharedHikes",
    call: () => getIncomingSharedHikes(),
    method: "GET",
    path: "/hikesharerecipient/incoming",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "getIncomingSharedHike",
    call: () => getIncomingSharedHike("h1"),
    method: "GET",
    path: "/hikesharerecipient/incoming/h1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "reshareHike",
    call: () => reshareHike(reshareRequest),
    method: "POST",
    path: "/hikesharerecipient/re-share",
    auth: "required",
    carriesStatus: true,
    body: reshareRequest,
  },
  {
    name: "acceptSharedHike",
    call: () => acceptSharedHike("h1"),
    method: "PUT",
    path: "/hikesharerecipient/accept/h1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "rejectSharedHike",
    call: () => rejectSharedHike("h1"),
    method: "DELETE",
    path: "/hikesharerecipient/reject/h1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "removeSharedHike",
    call: () => removeSharedHike("h1"),
    method: "DELETE",
    path: "/hikesharerecipient/h1",
    auth: "required",
    carriesStatus: true,
  },

  // friends
  {
    name: "sendFriendRequest",
    call: () => sendFriendRequest("stigvandraren"),
    method: "POST",
    path: "/friends/requests",
    auth: "required",
    carriesStatus: true,
    body: { receiverNickName: "stigvandraren" },
  },
  {
    name: "acceptFriendRequest",
    call: () => acceptFriendRequest("u1"),
    method: "PUT",
    path: "/friends/requests/accept/u1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "rejectFriendRequest",
    call: () => rejectFriendRequest("u1"),
    method: "DELETE",
    path: "/friends/reject/u1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "getFriends",
    call: () => getFriends(),
    method: "GET",
    path: "/friends",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "getIncomingRequests",
    call: () => getIncomingRequests(),
    method: "GET",
    path: "/friends/requests/incoming",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "getOutgoingRequests",
    call: () => getOutgoingRequests(),
    method: "GET",
    path: "/friends/requests/outgoing",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "removeFriend",
    call: () => removeFriend("u1"),
    method: "DELETE",
    path: "/friends/u1",
    auth: "required",
    carriesStatus: true,
  },
  {
    name: "searchUsers",
    call: () => searchUsers("anna banan"),
    method: "GET",
    path: "/users/search?username=anna%20banan",
    auth: "required",
    carriesStatus: true,
  },
];

// React Native's FormData keeps an appended {uri, type, name} object as-is; the standard
// FormData this environment provides stringifies it to "[object Object]", which would hide
// the multipart contract entirely. This records parts the way the runtime does.
class RecordingFormData {
  readonly parts: [string, unknown][] = [];
  append(key: string, value: unknown) {
    this.parts.push([key, value]);
  }
}

const realFormData = global.FormData;

beforeAll(() => {
  global.FormData = RecordingFormData as unknown as typeof FormData;
});

afterAll(() => {
  global.FormData = realFormData;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockToken.mockResolvedValue("bearer-token");
});

describe("api endpoint contract", () => {
  it("covers every exported endpoint in the table", () => {
    expect(endpoints).toHaveLength(52);
    expect(new Set(endpoints.map((e) => e.name)).size).toBe(endpoints.length);
  });

  describe.each(endpoints)("$name", (endpoint) => {
    it(`calls ${endpoint.method} ${endpoint.path}`, async () => {
      const fetchMock = mockFetch(true, 200, endpoint.name === "getReviewsByTrailIdentifier" ? { reviews: [] } : {});
      await endpoint.call();

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE}${endpoint.path}`);
      // A request sent with no init at all is a GET; anything else must say so explicitly.
      expect(init?.method ?? "GET").toBe(endpoint.method);
    });

    if (endpoint.auth === "required") {
      it("sends the bearer token", async () => {
        const fetchMock = mockFetch(true);
        await endpoint.call();

        const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer bearer-token");
      });
    }

    if (endpoint.auth === "none") {
      it("sends no Authorization header", async () => {
        const fetchMock = mockFetch(true, 200, { reviews: [] });
        await endpoint.call();

        const headers = (fetchMock.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
      });
    }

    if (endpoint.auth === "required") {
      it("refuses to reach the network without a token", async () => {
        mockToken.mockResolvedValue(null);
        const fetchMock = mockFetch(true);

        await expect(endpoint.call()).rejects.toThrow(/not authenticated/i);
        expect(fetchMock).not.toHaveBeenCalled();
      });
    }

    it("throws on a non-2xx response", async () => {
      mockFetch(false, 500);
      await expect(endpoint.call()).rejects.toThrow();
    });

    if (endpoint.carriesStatus) {
      // The 409 branches in the wishlist/favourite buttons read error.status, so a plain
      // Error here would silently degrade "already in list" into a generic failure.
      it("throws an ApiError carrying the status", async () => {
        mockFetch(false, 409);
        await expect(endpoint.call()).rejects.toMatchObject({ status: 409 });
        await expect(endpoint.call()).rejects.toBeInstanceOf(ApiError);
      });
    }

    if (endpoint.body !== undefined) {
      it("sends the documented JSON body", async () => {
        const fetchMock = mockFetch(true);
        await endpoint.call();

        const init = fetchMock.mock.calls[0][1];
        expect(JSON.parse(init.body as string)).toEqual(endpoint.body);
        expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
      });
    }
  });
});

// Behaviour the table cannot express, kept next to it because it is the same contract.
describe("endpoints that are not plain JSON", () => {
  it("createReview posts multipart with the review fields", async () => {
    const fetchMock = mockFetch(true);
    await createReview({ trailIdentifier: "t1", review: "Fin led", rating: 4 });

    const body = fetchMock.mock.calls[0][1].body as unknown as RecordingFormData;
    expect(body).toBeInstanceOf(RecordingFormData);
    expect(body.parts).toEqual(
      expect.arrayContaining([
        ["trailIdentifier", "t1"],
        ["trailReview", "Fin led"],
        ["rating", "4"],
      ]),
    );
  });

  it("createReview appends one image part per uri, each as a jpeg", async () => {
    const fetchMock = mockFetch(true);
    await createReview({ trailIdentifier: "t1", review: "Fin led", rating: 4, imageUris: ["file://a", "file://b"] });

    const body = fetchMock.mock.calls[0][1].body as unknown as RecordingFormData;
    const images = body.parts.filter(([key]) => key === "images") as [
      string,
      { uri: string; type: string; name: string },
    ][];
    expect(images).toHaveLength(2);
    expect(images.map(([, part]) => part.uri)).toEqual(["file://a", "file://b"]);
    expect(images.every(([, part]) => part.type === "image/jpeg")).toBe(true);
    // Names are generated per part, so two images can never collide server-side.
    expect(images[0][1].name).not.toBe(images[1][1].name);
    expect(images.every(([, part]) => part.name.endsWith(".jpg"))).toBe(true);
  });

  // Setting Content-Type by hand drops the multipart boundary and the upload fails server-side.
  it("createReview leaves Content-Type to the runtime", async () => {
    const fetchMock = mockFetch(true);
    await createReview({ trailIdentifier: "t1", review: "Fin led", rating: 4 });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers.Authorization).toBe("Bearer bearer-token");
  });

  it("getPopularTrails appends the position when it has one", async () => {
    const fetchMock = mockFetch(true);
    await getPopularTrails(57.72, 12.94);

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/trails/popular?latitude=57.72&longitude=12.94`);
  });

  it("getPopularTrails omits the query when longitude is missing", async () => {
    const fetchMock = mockFetch(true);
    await getPopularTrails(57.72, undefined);

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/trails/popular`);
  });

  it("getReviewsByTrailIdentifier returns the page the server sent", async () => {
    mockFetch(true, 200, { reviews: [{ identifier: "r1" }], total: 1, hasMore: false });
    const page = await getReviewsByTrailIdentifier("t1", 0, 5);

    expect(page).toEqual({ reviews: [{ identifier: "r1" }], total: 1, hasMore: false });
  });

  // An expired session must fail before the request, not as a 401 on "Bearer null".
  it.each([
    ["addSolvedVote", () => addSolvedVote("o1")],
    ["deleteSolvedVote", () => deleteSolvedVote("o1")],
  ])("%s never sends a null bearer token", async (_name, call) => {
    mockToken.mockResolvedValue(null);
    const fetchMock = mockFetch(true);

    await expect(call()).rejects.toThrow(/not authenticated/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
