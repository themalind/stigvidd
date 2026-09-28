// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

// React Native has no online event, so React Query assumes it is always online and never refetches on reconnect. keep-comment: hidden platform constraint
export function initOnlineStatus(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
}
