// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { OutgoingSharedHike, ShareRecipient } from "@/data/types";

export interface SentShare {
  hike: OutgoingSharedHike;
  sharedAt: string;
}

export function sharesTo(hikes: readonly OutgoingSharedHike[], recipientIdentifier: string): SentShare[] {
  return hikes
    .flatMap((hike) =>
      hike.recipients.filter((r) => r.identifier === recipientIdentifier).map((r) => ({ hike, sharedAt: r.sharedAt })),
    )
    .sort((a, b) => Date.parse(b.sharedAt) - Date.parse(a.sharedAt));
}

export function recipientsOf(hikes: readonly OutgoingSharedHike[], hikeIdentifier: string): ShareRecipient[] {
  return hikes.find((h) => h.hikeIdentifier === hikeIdentifier)?.recipients ?? [];
}
