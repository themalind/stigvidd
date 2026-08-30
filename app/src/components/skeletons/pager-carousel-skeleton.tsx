// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ShimmerBlock from "@/components/skeletons/shimmer-block";
import { View } from "react-native";

export default function PagerCarouselSkeleton() {
  return (
    <View style={{ gap: 8 }}>
      <ShimmerBlock style={{ width: "100%", aspectRatio: 16 / 10 }} />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <ShimmerBlock key={i} style={{ width: 6, height: 6, borderRadius: 3 }} />
        ))}
      </View>
    </View>
  );
}
