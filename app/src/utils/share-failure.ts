// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";

export type ShareFailure = "recipient_unavailable" | "not_allowed" | "error";

// 404: a picked friend is no longer a friend. 403: this user may not share the walk.
export function shareFailure(error: unknown): ShareFailure {
  if (!(error instanceof ApiError)) return "error";
  if (error.status === 404) return "recipient_unavailable";
  if (error.status === 403) return "not_allowed";
  return "error";
}
