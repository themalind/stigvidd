// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export type EventVisibility = "Open" | "Private";
export type EventStatus = "Published" | "Cancelled";
export type EventRole = "Organizer" | "CoHost" | "Participant";
export type EventParticipantStatus = "Joined" | "Interested" | "Removed";
export type EventRouteKind = "Trail" | "Own";

export interface EventPermissions {
  canEdit: boolean;
  canCancel: boolean;
  canDelete: boolean;
  canInvite: boolean;
  canJoin: boolean;
  canMarkInterested: boolean;
  canChangeRoles: boolean;
  canRemoveParticipants: boolean;
  canPinOrDeletePosts: boolean;
  canReadBoard: boolean;
  canPost: boolean;
}

export interface EventRoute {
  kind: EventRouteKind;
  lengthMeters?: number | null;
  // Own routes only, as JSON; a trail's path comes from the trail endpoint. keep-comment: why it is null for a trail
  coordinates?: string | null;
}

export interface HikingEvent {
  identifier: string;
  title: string;
  description: string;
  trailIdentifier?: string | null;
  trailName?: string | null;
  route?: EventRoute | null;
  locationName?: string | null;
  meetingPointLongitude?: number | null;
  meetingPointLatitude?: number | null;
  meetingPointName?: string | null;
  startsAt: string;
  endsAt?: string | null;
  registrationDeadline?: string | null;
  maxParticipants?: number | null;
  participantCount: number;
  interestedCount: number;
  visibility: EventVisibility;
  allowParticipantInvites: boolean;
  status: EventStatus;
  cancelledAt?: string | null;
  isPast: boolean;
  imageUrl?: string | null;
  imageIdentifier?: string | null;
  organizerNickName?: string | null;
  myRole?: EventRole | null;
  myStatus?: EventParticipantStatus | null;
  hasPendingInvite: boolean;
  unreadPostCount?: number;
  permissions: EventPermissions;
}

export interface EventSummary {
  identifier: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  placeName?: string | null;
  routeKind?: EventRouteKind | null;
  routeLengthMeters?: number | null;
  visibility: EventVisibility;
  status: EventStatus;
  participantCount: number;
  maxParticipants?: number | null;
  imageUrl?: string | null;
  organizerNickName?: string | null;
  distanceMeters?: number | null;
  myRole?: EventRole | null;
  myStatus?: EventParticipantStatus | null;
  unreadPostCount: number;
}

export interface EventPage {
  items: EventSummary[];
  nextCursor?: string | null;
}

export interface EventFeedQuery {
  trail?: string;
  organizer?: string;
  lat?: number;
  lon?: number;
  radiusKm?: number;
  limit?: number;
  cursor?: string;
  excludeMine?: boolean;
}

export interface MyEventsQuery {
  past?: boolean;
  limit?: number;
  cursor?: string;
}

export interface EventInvitation {
  event: EventSummary;
  invitedByNickName?: string | null;
  invitedAt: string;
}

export interface EventInvitee {
  userIdentifier: string;
  nickName: string;
  invitedByNickName?: string | null;
  invitedAt: string;
}

export interface EventParticipant {
  userIdentifier: string;
  nickName: string;
  role: EventRole;
  joinedAt: string;
}

export interface EventParticipants {
  participantCount: number;
  interestedCount: number;
  // Null for anyone who has not joined. keep-comment: outsiders see counts only
  participants?: EventParticipant[] | null;
  invited?: EventInvitee[] | null;
}

export interface EventPost {
  identifier: string;
  // Null for a deleted account. keep-comment: the app shows "borttagen användare"
  authorIdentifier?: string | null;
  authorNickName?: string | null;
  body: string;
  isPinned: boolean;
  createdAt: string;
  editedAt?: string | null;
  isMine: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface EventBoard {
  pinned: EventPost[];
  // Oldest first within a page; the cursor pages backwards. keep-comment: the board opens at the newest post
  posts: EventPost[];
  nextCursor?: string | null;
  lastReadPostAt?: string | null;
  muted: boolean;
}

export interface EventImage {
  identifier: string;
  imageUrl: string;
}

// Times go out as ISO strings with Z (toISOString). keep-comment: the server reads an offset-less time as UTC
export interface EventRequest {
  title: string;
  description: string;
  trailIdentifier?: string | null;
  hikeIdentifier?: string | null;
  routeTrimStartIndex?: number | null;
  routeTrimEndIndex?: number | null;
  locationName?: string | null;
  meetingPointLongitude?: number | null;
  meetingPointLatitude?: number | null;
  meetingPointName?: string | null;
  startsAt: string;
  endsAt?: string | null;
  registrationDeadline?: string | null;
  maxParticipants?: number | null;
  allowParticipantInvites: boolean;
}

export interface CreateEventRequest extends EventRequest {
  visibility: EventVisibility;
}

export interface UpdateEventRequest extends EventRequest {
  removeRoute?: boolean;
}
