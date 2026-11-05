// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { UserResponse } from "@/api/generated/model";
import { usersGetStigViddUser } from "@/api/generated/users/users";

export type StigviddUser = UserResponse;

export function getStigviddUser(): Promise<StigviddUser> {
  return usersGetStigViddUser();
}
