// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import * as Device from "expo-device";
import { getAppInfo } from "./app-info";

export const CLIENT_HEADER = "X-Stigvidd-Client";

// The API's 7-day traces only, never app logs or analytics: a model is not shared by every install of a build. keep-comment: GDPR boundary with AppInfo
export function clientHeaderValue(): string {
  const info = getAppInfo();
  const model = (Device.modelName ?? "unknown").replace(/[^\x20-\x7E]|[;=]/g, " ").trim() || "unknown";
  return `app=${info.appVersion};build=${info.buildNumber};platform=${info.platform};os=${info.osVersion};model=${model}`;
}
