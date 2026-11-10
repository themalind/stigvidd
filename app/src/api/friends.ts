// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import {
  BlockedUser,
  FriendProfile,
  FriendRequest,
  FriendResponse,
  OutgoingFriendRequest,
  SearchFriendResult,
} from "@/data/types";
import { isApiStatus } from "./core/api-error";
import { send, sendForJson } from "./core/request";

export async function sendFriendRequest(receiverNickName: string): Promise<{ success: boolean }> {
  await send({
    name: "sendFriendRequest",
    method: "POST",
    path: "/friends/requests",
    endpoint: "/friends/requests",
    body: { receiverNickName },
  });
  return { success: true };
}

export async function acceptFriendRequest(requesterIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "acceptFriendRequest",
    method: "PUT",
    path: `/friends/requests/accept/${requesterIdentifier}`,
    endpoint: "/friends/requests/accept/{param}",
  });
  return { success: true };
}

export async function rejectFriendRequest(otherIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "rejectFriendRequest",
    method: "DELETE",
    path: `/friends/reject/${otherIdentifier}`,
    endpoint: "/friends/reject/{param}",
  });
  return { success: true };
}

export function getFriends(): Promise<FriendResponse[]> {
  return sendForJson({ name: "getFriends", path: "/friends", endpoint: "/friends" });
}

export function getFriendProfile(friendIdentifier: string): Promise<FriendProfile> {
  return sendForJson({
    name: "getFriendProfile",
    path: `/friends/${friendIdentifier}/profile`,
    endpoint: "/friends/{param}/profile",
    // keep-comment: 404 is the backend's deliberate answer for a stranger or a block, not a failure
    quietStatuses: [404],
  });
}

export async function setFriendNote(friendIdentifier: string, note: string | null): Promise<{ success: boolean }> {
  await send({
    name: "setFriendNote",
    method: "PUT",
    path: `/friends/${friendIdentifier}/note`,
    endpoint: "/friends/{param}/note",
    body: { note },
  });
  return { success: true };
}

export function getIncomingRequests(): Promise<FriendRequest[]> {
  return sendForJson({
    name: "getIncomingRequests",
    path: "/friends/requests/incoming",
    endpoint: "/friends/requests/incoming",
  });
}

export function getOutgoingRequests(): Promise<OutgoingFriendRequest[]> {
  return sendForJson({
    name: "getOutgoingRequests",
    path: "/friends/requests/outgoing",
    endpoint: "/friends/requests/outgoing",
  });
}

export async function removeFriend(friendIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "removeFriend",
    method: "DELETE",
    path: `/friends/${friendIdentifier}`,
    endpoint: "/friends/{param}",
  });
  return { success: true };
}

export async function searchUsers(query: string): Promise<SearchFriendResult[]> {
  try {
    return await sendForJson<SearchFriendResult[]>({
      name: "searchUsers",
      path: `/users/search?username=${encodeURIComponent(query)}`,
      endpoint: "/users/search",
      quietStatuses: [404],
    });
  } catch (error) {
    if (isApiStatus(error, 404)) return [];
    throw error;
  }
}

export async function blockUser(otherIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "blockUser",
    method: "POST",
    path: `/friends/blocks/${otherIdentifier}`,
    endpoint: "/friends/blocks/{param}",
  });
  return { success: true };
}

export async function unblockUser(otherIdentifier: string): Promise<{ success: boolean }> {
  await send({
    name: "unblockUser",
    method: "DELETE",
    path: `/friends/blocks/${otherIdentifier}`,
    endpoint: "/friends/blocks/{param}",
  });
  return { success: true };
}

export function getBlockedUsers(): Promise<BlockedUser[]> {
  return sendForJson({ name: "getBlockedUsers", path: "/friends/blocks", endpoint: "/friends/blocks" });
}
