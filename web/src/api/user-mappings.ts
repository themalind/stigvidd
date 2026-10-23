// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  adminUserMappingsDeleteMapping,
  adminUserMappingsGetMappings,
  adminUserMappingsSaveMapping,
  adminUserMappingsSearchKeycloakUsers,
} from "./generated/admin-user-mappings/admin-user-mappings";
import type { KeycloakUserResponse, SaveUserMappingRequest, UserMappingsResponse } from "./generated/model";

export function getUserMappings(): Promise<UserMappingsResponse> {
  return adminUserMappingsGetMappings();
}

export async function saveUserMapping(packageUserId: number, request: SaveUserMappingRequest): Promise<void> {
  await adminUserMappingsSaveMapping(packageUserId, request);
}

export async function deleteUserMapping(packageUserId: number): Promise<void> {
  await adminUserMappingsDeleteMapping(packageUserId);
}

export function searchKeycloakUsers(search: string): Promise<KeycloakUserResponse[]> {
  return adminUserMappingsSearchKeycloakUsers({ search });
}
