// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ActiveHike } from "@/data/types";
import uuid from "react-native-uuid";

const NAMESPACE = "6f1c8a52-3d47-4e0b-9a16-2b7d5c9e8f30";

// Derived from the points, so it survives closing the form or the app and changes when the recording goes on.
export function recordingRequestKey(hike: ActiveHike): string {
  const points = hike.segments.flatMap((segment) => segment.coordinates);
  const name = `${hike.segments[0]?.startTime}:${points.length}:${points.at(-1)?.timeStamp}`;
  return uuid.v5(name, NAMESPACE) as string;
}
