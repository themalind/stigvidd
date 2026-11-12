// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { PANEL_BLEED, PANEL_PADDING } from "@/components/layout/section-panel";
import { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";

interface Props {
  testID?: string;
  children: ReactNode;
}

// keep-comment: a horizontal row of cards that runs to the panel's edges
export default function PanelCarousel({ testID, children }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={PANEL_BLEED}
      contentContainerStyle={s.row}
      testID={testID}
    >
      {children}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: {
    gap: 10,
    paddingHorizontal: PANEL_PADDING,
  },
});
