// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { adminUsersBanUser, adminUsersUnbanUser } from "./generated/admin-users/admin-users";

// A ban is read-only: the account still signs in and reads, and stops being able to write.
export async function banUser(identifier: string, reason?: string): Promise<void> {
  await adminUsersBanUser(identifier, { reason });
}

export async function unbanUser(identifier: string): Promise<void> {
  await adminUsersUnbanUser(identifier);
}
