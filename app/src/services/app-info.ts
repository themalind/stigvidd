// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Platform } from "react-native";
import Constants from "expo-constants";

// Never add a session, user or device id here: every value must be shared by all installs of a build. keep-comment: GDPR invariant
export type AppInfo = {
  appVersion: string;
  buildNumber: string;
  platform: string;
  osVersion: string;
};

function present(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "unknown" : String(value);
}

// Not Constants.nativeBuildVersion: expo-constants 18 never sets it. keep-comment: hidden library constraint
function buildNumber(): string {
  return present(
    Platform.OS === "ios" ? Constants.expoConfig?.ios?.buildNumber : Constants.expoConfig?.android?.versionCode,
  );
}

export function getAppInfo(): AppInfo {
  return {
    appVersion: present(Constants.expoConfig?.version),
    buildNumber: buildNumber(),
    platform: Platform.OS,
    // Android reports its API level (34), iOS its release ("17.4"). keep-comment: hidden platform difference
    osVersion: present(Platform.Version),
  };
}
