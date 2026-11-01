// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SHARE_LINK_BASE_URL } from "@/constants/constants";
import { logger } from "@/services/logger";
import { Share } from "react-native";

// The kinds the link site has a page for, and that +native-intent opens in the app. keep-comment: the two lists must match
export type SharedLinkKind = "trail" | "event";

export function shareLinkUrl(kind: SharedLinkKind, identifier: string): string {
  return `${SHARE_LINK_BASE_URL}/${kind}/${encodeURIComponent(identifier)}`;
}

export function shareMessage(message: string, kind: SharedLinkKind): void {
  Share.share({ message }).catch((error) => logger.warn(`Sharing a ${kind} failed`, { errorMessage: String(error) }));
}
