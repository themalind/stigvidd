// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { MaterialCommunityIcons } from "@expo/vector-icons";

export type FacilityIconName = keyof typeof MaterialCommunityIcons.glyphMap;

// keep-comment: one icon per kind of place, shared by the area page, the area tags and the map filter
export const FACILITY_ICONS = {
  firePit: "campfire",
  shelter: "tent",
  swimming: "swim",
  fishing: "fish",
  natureReserve: "pine-tree",
  accessible: "wheelchair-accessibility",
} as const satisfies Record<string, FacilityIconName>;
