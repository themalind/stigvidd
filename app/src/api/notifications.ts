// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { send } from "./core/request";

export async function registerPushToken(expoToken: string, platform: string): Promise<void> {
  await send({
    name: "registerPushToken",
    method: "POST",
    path: "/notifications/tokens",
    endpoint: "/notifications/tokens",
    body: { expoToken, platform },
  });
}

export async function unregisterPushToken(expoToken: string): Promise<void> {
  await send({
    name: "unregisterPushToken",
    method: "DELETE",
    path: `/notifications/tokens/${encodeURIComponent(expoToken)}`,
    endpoint: "/notifications/tokens/{param}",
  });
}
