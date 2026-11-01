// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The backend's EventRequestLimits. keep-comment: the two must match by hand
export const EVENT_REQUEST_LIMITS = {
  title: 80,
  description: 2000,
  placeName: 100,
  minParticipants: 2,
  maxParticipants: 500,
  maxLeadDays: 365,
  maxDurationDays: 14,
  postBody: 1000,
  invitesPerRequest: 20,
} as const;
