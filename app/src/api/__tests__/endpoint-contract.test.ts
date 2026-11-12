// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Every function in src/api is the same shape — token, fetch, !ok -> throw, log, rethrow —
// so the wire contract of all of them is asserted from one table here. Behaviour that is
// specific to an endpoint (pagination, multipart bodies) stays in the per-module suites.

jest.mock("@/api/core/api-config", () => ({
  ...jest.requireActual("@/api/core/api-config"),
  BASE_URL: "http://test/api/v1",
}));

jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

// The single source of every bearer token: mocking it here rather than mocking @/api/users
// keeps users.ts itself under test.
jest.mock("@/services/keycloak-auth", () => ({ getValidAccessToken: jest.fn() }));

import { getValidAccessToken } from "@/services/keycloak-auth";
import { File } from "expo-file-system";
import { ApiError, problemStrings } from "../core/api-error";
import { getAreaByIdentifier, getAreas } from "../areas";
import {
  acceptFriendRequest,
  getFriendProfile,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
  setFriendNote,
} from "../friends";
import {
  createHike,
  deleteHike,
  deleteHikeImage,
  getAllHikesByUserId,
  getHikeByIdentifier,
  shareHike,
  updateHike,
  uploadHikeImage,
} from "../hikes";
import {
  acceptEventInvitation,
  cancelEvent,
  createEvent,
  createEventPost,
  declineEventInvitation,
  deleteEvent,
  deleteEventImage,
  deleteEventPost,
  getEvent,
  getEventInvitations,
  getEventParticipants,
  getEventPosts,
  getEvents,
  getMyEvents,
  inviteToEvent,
  joinEvent,
  leaveEvent,
  markEventInterested,
  markEventPostsRead,
  removeEventParticipant,
  revokeEventInvitation,
  setEventImage,
  setEventMuted,
  setEventParticipantRole,
  setEventPostPinned,
  unmarkEventInterested,
  updateEvent,
  updateEventPost,
} from "../events";
import { getFacilityMarkers, getTrailMarkers } from "../map-markers";
import { registerPushToken, unregisterPushToken } from "../notifications";
import { createReview, deleteReview, getReviewsByTrailIdentifier, hasReviewedTrail } from "../reviews";
import {
  acceptSharedHike,
  getIncomingSharedHike,
  getIncomingSharedHikes,
  getOutgoingSharedHikes,
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
  getPopularContributedTrails,
  getPopularTrails,
  getTrailByIdentifier,
  getTrailCard,
  getTrailCards,
  getTrailLike,
  likeTrail,
  unlikeTrail,
} from "../trails";
import { createHikeSubmission, getMyHikeSubmissions, withdrawHikeSubmission } from "../hike-submissions";
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
//  - "optional"  is public, but sends the token when there is one, so the server can leave
//                out content from people this reader has blocked
type Auth = "required" | "none" | "optional";

interface Endpoint {
  name: string;
  call: () => Promise<unknown>;
  method: string;
  path: string;
  auth: Auth;
  body?: unknown;
}

const obstacleRequest = {
  description: "Nedfallet träd",
  issueType: "Hinder",
  trailIdentifier: "t1",
  incidentLongitude: 12.94,
  incidentLatitude: 57.72,
  clientRequestId: "11111111-1111-4111-8111-111111111111",
};

const createHikeRequest = {
  name: "Testpromenad",
  hikeLength: 5,
  duration: 3600,
  coordinates: [{ latitude: 57.72, longitude: 12.94 }],
  clientRequestId: "22222222-2222-4222-8222-222222222222",
};

const updateHikeRequest = {
  hikeIdentifier: "h1",
  parkingInfo: "Vid vandplanen",
  gettingThere: "Buss 100",
  description: "Fin runda",
};

const createEventRequest = {
  title: "Kvällsvandring",
  description: "Runt sjön",
  trailIdentifier: "t1",
  startsAt: "2026-11-05T17:00:00.000Z",
  allowParticipantInvites: false,
  visibility: "Open" as const,
  clientRequestId: "33333333-3333-4333-8333-333333333333",
};

const updateEventRequest = {
  title: "Kvällsvandring",
  description: "Runt sjön",
  startsAt: "2026-11-05T17:00:00.000Z",
  allowParticipantInvites: true,
  removeRoute: true,
};

const shareHikeRequest = { hikeIdentifier: "h1", sharedWithNames: ["stigvandraren"], allowResharing: true };

const reshareRequest = { hikeIdentifier: "h1", reShareToNames: ["stigvandraren"] };

const createSubmissionRequest = {
  hikeIdentifier: "h1",
  name: "Kvällsrunda",
  description: "Runt sjön",
  classification: 1,
  gettingThere: "Buss 3",
  city: "Borås",
  showSubmitterName: true,
  acceptTransfer: true,
  consentVersion: "2026-10-19",
  consentLocale: "sv",
  trimStartIndex: 2,
  imageIdentifiers: ["i1"],
};

const endpoints: Endpoint[] = [
  // areas
  { name: "getAreas", call: () => getAreas(), method: "GET", path: "/cityareas", auth: "none" },
  {
    name: "getAreaByIdentifier",
    call: () => getAreaByIdentifier("a1"),
    method: "GET",
    path: "/cityareas/a1",
    auth: "none",
  },

  // map markers
  {
    name: "getTrailMarkers",
    call: () => getTrailMarkers(),
    method: "GET",
    path: "/trails/markers",
    auth: "none",
  },
  {
    name: "getFacilityMarkers",
    call: () => getFacilityMarkers(),
    method: "GET",
    path: "/facilities",
    auth: "none",
  },

  // notifications
  {
    name: "registerPushToken",
    call: () => registerPushToken("ExponentPushToken[abc]", "ios"),
    method: "POST",
    path: "/notifications/tokens",
    auth: "required",
    body: { expoToken: "ExponentPushToken[abc]", platform: "ios" },
  },
  {
    name: "unregisterPushToken",
    call: () => unregisterPushToken("ExponentPushToken[abc]"),
    method: "DELETE",
    path: "/notifications/tokens/ExponentPushToken%5Babc%5D",
    auth: "required",
  },

  // reviews
  {
    name: "getReviewsByTrailIdentifier",
    call: () => getReviewsByTrailIdentifier("t1", 2, 5),
    method: "GET",
    path: "/reviews/trail/t1?page=2&limit=5",
    auth: "optional",
  },
  {
    name: "hasReviewedTrail",
    call: () => hasReviewedTrail("t1"),
    method: "GET",
    path: "/reviews/trail/t1/mine",
    auth: "required",
  },
  {
    name: "createReview",
    call: () => createReview({ trailIdentifier: "t1", review: "Fin led", rating: 4 }),
    method: "POST",
    path: "/reviews/create",
    auth: "required",
  },
  {
    name: "deleteReview",
    call: () => deleteReview("r1"),
    method: "DELETE",
    path: "/reviews/r1",
    auth: "required",
  },

  // trail obstacles
  {
    name: "getTrailObstaclesByTrailIdentifier",
    call: () => getTrailObstaclesByTrailIdentifier("t1"),
    method: "GET",
    path: "/trailobstacles/trail/t1",
    auth: "optional",
  },
  {
    name: "addSolvedVote",
    call: () => addSolvedVote("o1"),
    method: "POST",
    path: "/trailobstacles/solve/o1",
    auth: "required",
  },
  {
    name: "deleteSolvedVote",
    call: () => deleteSolvedVote("o1"),
    method: "DELETE",
    path: "/trailobstacles/solve/o1",
    auth: "required",
  },
  {
    name: "createTrailObstacle",
    call: () => createTrailObstacle(obstacleRequest),
    method: "POST",
    path: "/trailobstacles",
    auth: "required",
    body: obstacleRequest,
  },
  {
    name: "updateTrailObstacle",
    call: () => updateTrailObstacle("o1", { description: "Röjt", issueType: "Hinder" }),
    method: "PUT",
    path: "/trailobstacles/o1",
    auth: "required",
    body: { description: "Röjt", issueType: "Hinder" },
  },
  {
    name: "getObstacleIssueTypes",
    call: () => getObstacleIssueTypes(),
    method: "GET",
    path: "/trailobstacles/issue-types",
    auth: "none",
  },
  {
    name: "deleteTrailObstacle",
    call: () => deleteTrailObstacle("o1"),
    method: "DELETE",
    path: "/trailobstacles/o1",
    auth: "required",
  },

  // users
  {
    name: "getStigViddUser",
    call: () => getStigViddUser(),
    method: "GET",
    path: "/users",
    auth: "required",
  },
  {
    name: "getUserFavorites",
    call: () => getUserFavorites(),
    method: "GET",
    path: "/users/favorites",
    auth: "required",
  },
  {
    name: "getUserWishlist",
    call: () => getUserWishlist(),
    method: "GET",
    path: "/users/wishlist",
    auth: "required",
  },
  {
    name: "addToUserFavorite",
    call: () => addToUserFavorite("t1"),
    method: "POST",
    path: "/users/favorites",
    auth: "required",
    body: { trailIdentifier: "t1" },
  },
  {
    name: "addToUserWishlist",
    call: () => addToUserWishlist("t1"),
    method: "POST",
    path: "/users/wishlist",
    auth: "required",
    body: { trailIdentifier: "t1" },
  },
  {
    name: "removeUserFavorite",
    call: () => removeUserFavorite("t1"),
    method: "DELETE",
    path: "/users/favorites/t1",
    auth: "required",
  },
  {
    name: "removeUserWishlist",
    call: () => removeUserWishlist("t1"),
    method: "DELETE",
    path: "/users/wishlist/t1",
    auth: "required",
  },
  {
    name: "deleteStigViddUser",
    call: () => deleteStigViddUser(),
    method: "DELETE",
    path: "/users/delete",
    auth: "required",
  },

  // trails
  {
    name: "getPopularTrails",
    call: () => getPopularTrails(),
    method: "GET",
    path: "/trails/popular",
    auth: "none",
  },
  {
    name: "getPopularContributedTrails",
    call: () => getPopularContributedTrails(),
    method: "GET",
    path: "/trails/popular-contributions",
    auth: "none",
  },
  {
    name: "getTrailLike",
    call: () => getTrailLike("t1"),
    method: "GET",
    path: "/trails/t1/like",
    auth: "required",
  },
  {
    name: "likeTrail",
    call: () => likeTrail("t1"),
    method: "PUT",
    path: "/trails/t1/like",
    auth: "required",
  },
  {
    name: "unlikeTrail",
    call: () => unlikeTrail("t1"),
    method: "DELETE",
    path: "/trails/t1/like",
    auth: "required",
  },
  {
    name: "createHikeSubmission",
    call: () => createHikeSubmission(createSubmissionRequest),
    method: "POST",
    path: "/hikesubmissions",
    auth: "required",
    body: createSubmissionRequest,
  },
  {
    name: "getMyHikeSubmissions",
    call: () => getMyHikeSubmissions(),
    method: "GET",
    path: "/hikesubmissions",
    auth: "required",
  },
  {
    name: "withdrawHikeSubmission",
    call: () => withdrawHikeSubmission("s1"),
    method: "DELETE",
    path: "/hikesubmissions/s1",
    auth: "required",
  },
  {
    name: "getAllTrails",
    call: () => getAllTrails(),
    method: "GET",
    path: "/trails",
    auth: "none",
  },
  {
    name: "getTrailByIdentifier",
    call: () => getTrailByIdentifier("t1"),
    method: "GET",
    path: "/trails/t1",
    auth: "none",
  },
  {
    name: "getTrailCard",
    call: () => getTrailCard("t1"),
    method: "GET",
    path: "/trails/t1/card",
    auth: "none",
  },
  {
    name: "getTrailCards",
    call: () => getTrailCards(["a", "b"]),
    method: "POST",
    path: "/trails/cards",
    auth: "none",
    body: { identifiers: ["a", "b"] },
  },
  {
    name: "getCoordinatesByTrailIdentifier",
    call: () => getCoordinatesByTrailIdentifier("t1"),
    method: "GET",
    path: "/trails/t1/coordinates",
    auth: "none",
  },

  // hikes
  {
    name: "createHike",
    call: () => createHike(createHikeRequest),
    method: "POST",
    path: "/hikes",
    auth: "required",
    // The coordinate array travels as a JSON string, not as nested JSON.
    body: { ...createHikeRequest, coordinates: JSON.stringify(createHikeRequest.coordinates) },
  },
  {
    name: "updateHike",
    call: () => updateHike(updateHikeRequest),
    method: "PUT",
    path: "/hikes/h1",
    auth: "required",
    body: updateHikeRequest,
  },
  {
    name: "getHikeByIdentifier",
    call: () => getHikeByIdentifier("h1"),
    method: "GET",
    path: "/hikes/h1",
    auth: "required",
  },
  {
    name: "getAllHikesByUserId",
    call: () => getAllHikesByUserId("u1"),
    method: "GET",
    path: "/hikes?createdBy=u1",
    auth: "required",
  },
  {
    name: "shareHike",
    call: () => shareHike(shareHikeRequest),
    method: "POST",
    path: "/hikeshares/share",
    auth: "required",
    body: shareHikeRequest,
  },
  {
    name: "deleteHike",
    call: () => deleteHike("h1"),
    method: "DELETE",
    path: "/hikes/h1",
    auth: "required",
  },
  {
    name: "uploadHikeImage",
    call: () => uploadHikeImage("h1", "file:///photo.jpg"),
    method: "POST",
    path: "/hikes/h1/images",
    auth: "required",
  },
  {
    name: "deleteHikeImage",
    call: () => deleteHikeImage("h1", "img1"),
    method: "DELETE",
    path: "/hikes/h1/images/img1",
    auth: "required",
  },

  // shared hikes
  {
    name: "getSharedHikes",
    call: () => getSharedHikes(),
    method: "GET",
    path: "/hikesharerecipient",
    auth: "required",
  },
  {
    name: "getOutgoingSharedHikes",
    call: () => getOutgoingSharedHikes(),
    method: "GET",
    path: "/hikeshares/outgoing",
    auth: "required",
  },
  {
    name: "getIncomingSharedHikes",
    call: () => getIncomingSharedHikes(),
    method: "GET",
    path: "/hikesharerecipient/incoming",
    auth: "required",
  },
  {
    name: "getIncomingSharedHike",
    call: () => getIncomingSharedHike("h1"),
    method: "GET",
    path: "/hikesharerecipient/incoming/h1",
    auth: "required",
  },
  {
    name: "reshareHike",
    call: () => reshareHike(reshareRequest),
    method: "POST",
    path: "/hikesharerecipient/re-share",
    auth: "required",
    body: reshareRequest,
  },
  {
    name: "acceptSharedHike",
    call: () => acceptSharedHike("h1"),
    method: "PUT",
    path: "/hikesharerecipient/accept/h1",
    auth: "required",
  },
  {
    name: "rejectSharedHike",
    call: () => rejectSharedHike("h1"),
    method: "DELETE",
    path: "/hikesharerecipient/reject/h1",
    auth: "required",
  },
  {
    name: "removeSharedHike",
    call: () => removeSharedHike("h1"),
    method: "DELETE",
    path: "/hikesharerecipient/h1",
    auth: "required",
  },

  // friends
  {
    name: "sendFriendRequest",
    call: () => sendFriendRequest("stigvandraren"),
    method: "POST",
    path: "/friends/requests",
    auth: "required",
    body: { receiverNickName: "stigvandraren" },
  },
  {
    name: "acceptFriendRequest",
    call: () => acceptFriendRequest("u1"),
    method: "PUT",
    path: "/friends/requests/accept/u1",
    auth: "required",
  },
  {
    name: "rejectFriendRequest",
    call: () => rejectFriendRequest("u1"),
    method: "DELETE",
    path: "/friends/reject/u1",
    auth: "required",
  },
  {
    name: "getFriends",
    call: () => getFriends(),
    method: "GET",
    path: "/friends",
    auth: "required",
  },
  {
    name: "getIncomingRequests",
    call: () => getIncomingRequests(),
    method: "GET",
    path: "/friends/requests/incoming",
    auth: "required",
  },
  {
    name: "getOutgoingRequests",
    call: () => getOutgoingRequests(),
    method: "GET",
    path: "/friends/requests/outgoing",
    auth: "required",
  },
  {
    name: "removeFriend",
    call: () => removeFriend("u1"),
    method: "DELETE",
    path: "/friends/u1",
    auth: "required",
  },
  {
    name: "getFriendProfile",
    call: () => getFriendProfile("u1"),
    method: "GET",
    path: "/friends/u1/profile",
    auth: "required",
  },
  {
    name: "setFriendNote",
    call: () => setFriendNote("u1", "Kusin"),
    method: "PUT",
    path: "/friends/u1/note",
    auth: "required",
    body: { note: "Kusin" },
  },
  {
    name: "searchUsers",
    call: () => searchUsers("anna banan"),
    method: "GET",
    path: "/users/search?username=anna%20banan",
    auth: "required",
  },

  {
    name: "getEvents",
    call: () => getEvents({ lat: 57.72, lon: 12.94, radiusKm: 25, cursor: "a+b/c" }),
    method: "GET",
    path: "/events?lat=57.72&lon=12.94&radiusKm=25&cursor=a%2Bb%2Fc",
    auth: "optional",
  },
  {
    name: "getMyEvents",
    call: () => getMyEvents({ past: true }),
    method: "GET",
    path: "/events/mine?past=true",
    auth: "required",
  },
  {
    name: "getEvent",
    call: () => getEvent("e1"),
    method: "GET",
    path: "/events/e1",
    auth: "optional",
  },
  {
    name: "createEvent",
    call: () => createEvent(createEventRequest),
    method: "POST",
    path: "/events",
    auth: "required",
    body: createEventRequest,
  },
  {
    name: "updateEvent",
    call: () => updateEvent("e1", updateEventRequest),
    method: "PUT",
    path: "/events/e1",
    auth: "required",
    body: updateEventRequest,
  },
  {
    name: "cancelEvent",
    call: () => cancelEvent("e1"),
    method: "POST",
    path: "/events/e1/cancel",
    auth: "required",
  },
  {
    name: "deleteEvent",
    call: () => deleteEvent("e1"),
    method: "DELETE",
    path: "/events/e1",
    auth: "required",
  },
  {
    name: "joinEvent",
    call: () => joinEvent("e1"),
    method: "POST",
    path: "/events/e1/join",
    auth: "required",
  },
  {
    name: "leaveEvent",
    call: () => leaveEvent("e1"),
    method: "DELETE",
    path: "/events/e1/leave",
    auth: "required",
  },
  {
    name: "markEventInterested",
    call: () => markEventInterested("e1"),
    method: "POST",
    path: "/events/e1/interested",
    auth: "required",
  },
  {
    name: "unmarkEventInterested",
    call: () => unmarkEventInterested("e1"),
    method: "DELETE",
    path: "/events/e1/interested",
    auth: "required",
  },
  {
    name: "getEventParticipants",
    call: () => getEventParticipants("e1"),
    method: "GET",
    path: "/events/e1/participants",
    auth: "required",
  },
  {
    name: "removeEventParticipant",
    call: () => removeEventParticipant("e1", "u1"),
    method: "DELETE",
    path: "/events/e1/participants/u1",
    auth: "required",
  },
  {
    name: "setEventParticipantRole",
    call: () => setEventParticipantRole("e1", "u1", "CoHost"),
    method: "PUT",
    path: "/events/e1/participants/u1/role",
    auth: "required",
    body: { role: "CoHost" },
  },
  {
    name: "setEventMuted",
    call: () => setEventMuted("e1", true),
    method: "PUT",
    path: "/events/e1/mute",
    auth: "required",
    body: { muted: true },
  },
  {
    name: "inviteToEvent",
    call: () => inviteToEvent("e1", ["stigvandraren"]),
    method: "POST",
    path: "/events/e1/invite",
    auth: "required",
    body: { nickNames: ["stigvandraren"] },
  },
  {
    name: "revokeEventInvitation",
    call: () => revokeEventInvitation("e1", "u1"),
    method: "DELETE",
    path: "/events/e1/invitations/u1",
    auth: "required",
  },
  {
    name: "getEventInvitations",
    call: () => getEventInvitations(),
    method: "GET",
    path: "/events/invitations",
    auth: "required",
  },
  {
    name: "acceptEventInvitation",
    call: () => acceptEventInvitation("e1"),
    method: "POST",
    path: "/events/invitations/e1/accept",
    auth: "required",
  },
  {
    name: "declineEventInvitation",
    call: () => declineEventInvitation("e1"),
    method: "DELETE",
    path: "/events/invitations/e1",
    auth: "required",
  },
  {
    name: "getEventPosts",
    call: () => getEventPosts("e1", "c1"),
    method: "GET",
    path: "/events/e1/posts?cursor=c1",
    auth: "required",
  },
  {
    name: "createEventPost",
    call: () => createEventPost("e1", "Vi ses vid parkeringen", "44444444-4444-4444-8444-444444444444"),
    method: "POST",
    path: "/events/e1/posts",
    auth: "required",
    body: { body: "Vi ses vid parkeringen", clientRequestId: "44444444-4444-4444-8444-444444444444" },
  },
  {
    name: "markEventPostsRead",
    call: () => markEventPostsRead("e1", "2026-11-01T09:00:00.000Z"),
    method: "PUT",
    path: "/events/e1/posts/read",
    auth: "required",
    body: { readUpTo: "2026-11-01T09:00:00.000Z" },
  },
  {
    name: "updateEventPost",
    call: () => updateEventPost("p1", "Ändrad tid"),
    method: "PUT",
    path: "/events/posts/p1",
    auth: "required",
    body: { body: "Ändrad tid" },
  },
  {
    name: "deleteEventPost",
    call: () => deleteEventPost("p1"),
    method: "DELETE",
    path: "/events/posts/p1",
    auth: "required",
  },
  {
    name: "setEventPostPinned",
    call: () => setEventPostPinned("p1", true),
    method: "PUT",
    path: "/events/posts/p1/pin",
    auth: "required",
    body: { pinned: true },
  },
  {
    name: "setEventImage",
    call: () => setEventImage("e1", "file://cover"),
    method: "POST",
    path: "/events/e1/image",
    auth: "required",
  },
  {
    name: "deleteEventImage",
    call: () => deleteEventImage("e1"),
    method: "DELETE",
    path: "/events/e1/image",
    auth: "required",
  },
];

// The runtime's FormData keeps an appended part object as-is; the standard FormData this
// environment provides stringifies it to "[object Object]", which would hide the multipart
// contract entirely. This records parts the way the runtime does.
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
    expect(endpoints).toHaveLength(92);
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

    if (endpoint.auth === "optional") {
      it("sends the bearer token when there is one", async () => {
        const fetchMock = mockFetch(true, 200, { reviews: [] });
        await endpoint.call();

        const headers = (fetchMock.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer bearer-token");
      });

      it("still reaches the network without one, since a signed-out reader has no blocks", async () => {
        mockToken.mockResolvedValue(null);
        const fetchMock = mockFetch(true, 200, { reviews: [] });

        await endpoint.call();

        const headers = (fetchMock.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
        expect(fetchMock).toHaveBeenCalledTimes(1);
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

    // The 409 branches in the wishlist/favourite buttons read error.status, so a plain
    // Error here would silently degrade "already in list" into a generic failure.
    it("throws an ApiError carrying the status", async () => {
      mockFetch(false, 409);
      await expect(endpoint.call()).rejects.toMatchObject({ status: 409 });
      await expect(endpoint.call()).rejects.toBeInstanceOf(ApiError);
    });

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
    await createReview({
      trailIdentifier: "t1",
      review: "Fin led",
      rating: 4,
      imageUris: ["file:///cache/a.jpg", "file:///cache/b.jpg"],
    });

    const body = fetchMock.mock.calls[0][1].body as unknown as RecordingFormData;
    const images = body.parts.filter(([key]) => key === "images").map(([, part]) => part);
    expect(images).toHaveLength(2);
    expect(images.every((part) => part instanceof File)).toBe(true);
    expect(images.map((part) => (part as File).uri)).toEqual(["file:///cache/a.jpg", "file:///cache/b.jpg"]);
  });

  // Setting Content-Type by hand drops the multipart boundary and the upload fails server-side.
  it("createReview leaves Content-Type to the runtime", async () => {
    const fetchMock = mockFetch(true);
    await createReview({ trailIdentifier: "t1", review: "Fin led", rating: 4 });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers.Authorization).toBe("Bearer bearer-token");
  });

  it("setEventImage posts the cover as one multipart image part", async () => {
    const fetchMock = mockFetch(true);
    await setEventImage("e1", "file:///cache/cover.jpg");

    const init = fetchMock.mock.calls[0][1];
    const body = init.body as unknown as RecordingFormData;
    expect(body.parts).toHaveLength(1);
    const [key, part] = body.parts[0];
    expect(key).toBe("image");
    expect(part).toBeInstanceOf(File);
    expect((part as File).uri).toBe("file:///cache/cover.jpg");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("an event error carries the ProblemDetails code", async () => {
    mockFetch(false, 409, { title: "Conflict", status: 409, code: "event_full" });

    await expect(joinEvent("e1")).rejects.toMatchObject({ status: 409, code: "event_full" });
  });

  it("an invite naming unknown nicknames carries them on the error", async () => {
    mockFetch(false, 404, { status: 404, code: "unknown_nicknames", nickNames: ["borta", 7] });

    const error = await inviteToEvent("e1", ["borta", "kvar"]).catch((caught: unknown) => caught);
    expect(problemStrings(error, "nickNames")).toEqual(["borta"]);
  });

  it("an uncoded event error carries no code", async () => {
    mockFetch(false, 400, "Titel saknas");

    await expect(createEventPost("e1", "", "k")).rejects.toMatchObject({ status: 400, code: undefined });
  });

  it("getEvents leaves out what the caller did not set", async () => {
    const fetchMock = mockFetch(true);
    await getEvents();

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/events`);
  });

  it("getAreas appends the position when it has one", async () => {
    const fetchMock = mockFetch(true);
    await getAreas(57.72, 12.94);

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/cityareas?latitude=57.72&longitude=12.94`);
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
