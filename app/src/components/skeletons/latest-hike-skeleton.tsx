// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CARD_HEIGHT } from "@/components/home/latest-hike-card";
import ShimmerBlock from "@/components/skeletons/shimmer-block";
import SectionPanel, { PANEL_BLEED, PANEL_PADDING } from "@/components/section-panel";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";

// keep-comment: the heading is real, since it is known before the data; only the card is a placeholder
export default function LatestHikeSkeleton() {
  const { t } = useTranslation();

  return (
    <SectionPanel title={t("home.latestHike")}>
      <ShimmerBlock style={[s.card, PANEL_BLEED]} />
    </SectionPanel>
  );
}

// keep-comment: mirrors latest-hike-card's metrics so the card drops in without a shift
const s = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    marginBottom: -PANEL_PADDING,
    borderRadius: 0,
  },
});
