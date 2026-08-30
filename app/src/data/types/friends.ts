// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export interface SearchFriendResult {
  identifier: string;
  nickName: string;
}

export interface FriendResponse {
  identifier: string;
  nickName: string;
}

export interface FriendRequest {
  requesterIdentifier: string;
  requesterNickName: string;
  createdAt: string;
}

export interface OutgoingFriendRequest {
  receiverIdentifier: string;
  receiverNickName: string;
  createdAt: string;
}
