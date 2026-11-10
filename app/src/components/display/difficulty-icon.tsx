// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { FontAwesome6, Ionicons, MaterialIcons } from "@expo/vector-icons";

export function getDifficultyIcon(classification: string) {
  switch (classification) {
    case "Svår":
      return <Ionicons name="triangle" size={12} color="#f50" />;
    case "Medel":
      return <FontAwesome6 name="diamond" size={10} color="#bbaa00" />;
    case "Lätt":
      return <MaterialIcons name="circle" size={10} color="green" />;
    default:
      return <MaterialIcons name="circle" size={10} color="grey" />;
  }
}
