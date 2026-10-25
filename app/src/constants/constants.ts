// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export const BORDER_RADIUS = 5;
export const SURFACE_BORDER_RADIUS = BORDER_RADIUS;
export const DIALOG_BORDER_RADIUS = BORDER_RADIUS;
export const SCREEN_PADDING = 10;
// keep-comment: must match RecipientRules.MaxRecipients in the backend
export const MAX_SHARE_RECIPIENTS = 10;
// keep-comment: must match HikeService.MaxHikeImages in the backend
export const MAX_HIKE_IMAGES = 10;
// keep-comment: must match HikeSubmissionLimits.PendingPerUser in the backend
export const MAX_PENDING_SUBMISSIONS = 3;
// keep-comment: must match CreateUserRequestValidator in the backend
export const MIN_NICKNAME_LENGTH = 2;
// keep-comment: must not exceed the shortest nickname any existing account has, or that account can't be found
export const MIN_USER_SEARCH_LENGTH = 2;
// keep-comment: must match FriendNote.MaxLength in the backend
export const FRIEND_NOTE_MAX_LENGTH = 60;
// keep-comment: white text over a photo or map must stay legible on any bright patch beneath it
export const OVERLAY_TEXT_SHADOW = {
  textShadowColor: "rgba(0,0,0,0.55)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;
// Registered in Play Console, App Store Connect and §9 of the policy; never change the path. keep-comment: external registrations
export const PRIVACY_POLICY_URL = "https://stigvidd.se/privacy-policy/";
export const TERMS_OF_USE_URL = "https://stigvidd.se/terms-of-use/";
export const DELETE_ACCOUNT_URL = "https://stigvidd.se/delete-account/";
// Shared links outlive the app version that made them, and the iOS build's associatedDomains names this host. keep-comment: why the host and path must not change
export const SHARE_LINK_BASE_URL = "https://link.stigvidd.se";
// AGPL section 13 obliges offering the backend's source to its users; the About screen links here. keep-comment: licence obligation
export const SOURCE_CODE_URL = "https://github.com/themalind/stigvidd";
export const START_COORDINATE_BORAS = {
  latitude: 57.72096,
  longitude: 12.93816,
  latitudeDelta: 0.2,
  longitudeDelta: 0.1,
};
