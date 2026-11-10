// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import {
  CreateEventRequest,
  EventBoard,
  EventFeedQuery,
  EventImage,
  EventInvitation,
  EventPage,
  EventParticipants,
  EventPost,
  EventRole,
  HikingEvent,
  MyEventsQuery,
  UpdateEventRequest,
} from "@/data/types";
import { imageFormPart } from "./core/image-form-part";
import { queryString as query, send, sendForJson } from "./core/request";

function eventPath(identifier: string): string {
  return `/events/${encodeURIComponent(identifier)}`;
}

export function getEvents(feed: EventFeedQuery = {}): Promise<EventPage> {
  return sendForJson({
    name: "getEvents",
    method: "GET",
    path: `/events${query({ ...feed })}`,
    endpoint: "/events",
    auth: "optional",
  });
}

export function getMyEvents(mine: MyEventsQuery = {}): Promise<EventPage> {
  return sendForJson({
    name: "getMyEvents",
    method: "GET",
    path: `/events/mine${query({ ...mine })}`,
    endpoint: "/events/mine",
  });
}

export function getEvent(identifier: string): Promise<HikingEvent> {
  return sendForJson({
    name: "getEvent",
    method: "GET",
    path: eventPath(identifier),
    endpoint: "/events/{param}",
    auth: "optional",
  });
}

export function createEvent(request: CreateEventRequest): Promise<HikingEvent> {
  return sendForJson({
    name: "createEvent",
    method: "POST",
    path: "/events",
    endpoint: "/events",
    body: request,
  });
}

export function updateEvent(identifier: string, request: UpdateEventRequest): Promise<HikingEvent> {
  return sendForJson({
    name: "updateEvent",
    method: "PUT",
    path: eventPath(identifier),
    endpoint: "/events/{param}",
    body: request,
  });
}

export async function cancelEvent(identifier: string): Promise<void> {
  await send({
    name: "cancelEvent",
    method: "POST",
    path: `${eventPath(identifier)}/cancel`,
    endpoint: "/events/{param}/cancel",
  });
}

export async function deleteEvent(identifier: string): Promise<void> {
  await send({
    name: "deleteEvent",
    method: "DELETE",
    path: eventPath(identifier),
    endpoint: "/events/{param}",
  });
}

export async function joinEvent(identifier: string): Promise<void> {
  await send({
    name: "joinEvent",
    method: "POST",
    path: `${eventPath(identifier)}/join`,
    endpoint: "/events/{param}/join",
  });
}

export async function leaveEvent(identifier: string): Promise<void> {
  await send({
    name: "leaveEvent",
    method: "DELETE",
    path: `${eventPath(identifier)}/leave`,
    endpoint: "/events/{param}/leave",
  });
}

export async function markEventInterested(identifier: string): Promise<void> {
  await send({
    name: "markEventInterested",
    method: "POST",
    path: `${eventPath(identifier)}/interested`,
    endpoint: "/events/{param}/interested",
  });
}

export async function unmarkEventInterested(identifier: string): Promise<void> {
  await send({
    name: "unmarkEventInterested",
    method: "DELETE",
    path: `${eventPath(identifier)}/interested`,
    endpoint: "/events/{param}/interested",
  });
}

export function getEventParticipants(identifier: string): Promise<EventParticipants> {
  return sendForJson({
    name: "getEventParticipants",
    method: "GET",
    path: `${eventPath(identifier)}/participants`,
    endpoint: "/events/{param}/participants",
  });
}

export async function removeEventParticipant(identifier: string, userIdentifier: string): Promise<void> {
  await send({
    name: "removeEventParticipant",
    method: "DELETE",
    path: `${eventPath(identifier)}/participants/${encodeURIComponent(userIdentifier)}`,
    endpoint: "/events/{param}/participants/{param}",
  });
}

export async function setEventParticipantRole(
  identifier: string,
  userIdentifier: string,
  role: Exclude<EventRole, "Organizer">,
): Promise<void> {
  await send({
    name: "setEventParticipantRole",
    method: "PUT",
    path: `${eventPath(identifier)}/participants/${encodeURIComponent(userIdentifier)}/role`,
    endpoint: "/events/{param}/participants/{param}/role",
    body: { role },
  });
}

export async function setEventMuted(identifier: string, muted: boolean): Promise<void> {
  await send({
    name: "setEventMuted",
    method: "PUT",
    path: `${eventPath(identifier)}/mute`,
    endpoint: "/events/{param}/mute",
    body: { muted },
  });
}

export async function inviteToEvent(identifier: string, nickNames: string[]): Promise<void> {
  await send({
    name: "inviteToEvent",
    method: "POST",
    path: `${eventPath(identifier)}/invite`,
    endpoint: "/events/{param}/invite",
    body: { nickNames },
  });
}

export async function revokeEventInvitation(identifier: string, inviteeIdentifier: string): Promise<void> {
  await send({
    name: "revokeEventInvitation",
    method: "DELETE",
    path: `${eventPath(identifier)}/invitations/${encodeURIComponent(inviteeIdentifier)}`,
    endpoint: "/events/{param}/invitations/{param}",
  });
}

export function getEventInvitations(): Promise<EventInvitation[]> {
  return sendForJson({
    name: "getEventInvitations",
    method: "GET",
    path: "/events/invitations",
    endpoint: "/events/invitations",
  });
}

export async function acceptEventInvitation(identifier: string): Promise<void> {
  await send({
    name: "acceptEventInvitation",
    method: "POST",
    path: `/events/invitations/${encodeURIComponent(identifier)}/accept`,
    endpoint: "/events/invitations/{param}/accept",
  });
}

export async function declineEventInvitation(identifier: string): Promise<void> {
  await send({
    name: "declineEventInvitation",
    method: "DELETE",
    path: `/events/invitations/${encodeURIComponent(identifier)}`,
    endpoint: "/events/invitations/{param}",
  });
}

export function getEventPosts(identifier: string, cursor?: string): Promise<EventBoard> {
  return sendForJson({
    name: "getEventPosts",
    method: "GET",
    path: `${eventPath(identifier)}/posts${query({ cursor })}`,
    endpoint: "/events/{param}/posts",
  });
}

export function createEventPost(identifier: string, body: string, clientRequestId: string): Promise<EventPost> {
  return sendForJson({
    name: "createEventPost",
    method: "POST",
    path: `${eventPath(identifier)}/posts`,
    endpoint: "/events/{param}/posts",
    body: { body, clientRequestId },
  });
}

// readUpTo is the CreatedAt of the newest post shown, never the device clock. keep-comment: the server only moves the marker forward
export async function markEventPostsRead(identifier: string, readUpTo: string): Promise<void> {
  await send({
    name: "markEventPostsRead",
    method: "PUT",
    path: `${eventPath(identifier)}/posts/read`,
    endpoint: "/events/{param}/posts/read",
    body: { readUpTo },
  });
}

export function updateEventPost(postIdentifier: string, body: string): Promise<EventPost> {
  return sendForJson({
    name: "updateEventPost",
    method: "PUT",
    path: `/events/posts/${encodeURIComponent(postIdentifier)}`,
    endpoint: "/events/posts/{param}",
    body: { body },
  });
}

export async function deleteEventPost(postIdentifier: string): Promise<void> {
  await send({
    name: "deleteEventPost",
    method: "DELETE",
    path: `/events/posts/${encodeURIComponent(postIdentifier)}`,
    endpoint: "/events/posts/{param}",
  });
}

export async function setEventPostPinned(postIdentifier: string, pinned: boolean): Promise<void> {
  await send({
    name: "setEventPostPinned",
    method: "PUT",
    path: `/events/posts/${encodeURIComponent(postIdentifier)}/pin`,
    endpoint: "/events/posts/{param}/pin",
    body: { pinned },
  });
}

export function setEventImage(identifier: string, uri: string, focusY?: number): Promise<EventImage> {
  const form = new FormData();
  form.append("image", imageFormPart(uri));
  if (focusY !== undefined) form.append("focusY", String(focusY));

  return sendForJson({
    name: "setEventImage",
    method: "POST",
    path: `${eventPath(identifier)}/image`,
    endpoint: "/events/{param}/image",
    form,
  });
}

export async function deleteEventImage(identifier: string): Promise<void> {
  await send({
    name: "deleteEventImage",
    method: "DELETE",
    path: `${eventPath(identifier)}/image`,
    endpoint: "/events/{param}/image",
  });
}
