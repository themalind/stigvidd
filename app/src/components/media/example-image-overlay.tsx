// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { asTranslationKey } from "@/i18n";
import { isMockImage } from "@/components/media/is-mock-image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

type Props = {
  source: unknown;
  variant?: "badge" | "watermark";
};

// keep-comment: narrower and a corner pill would cover the picture, so a bottom ribbon instead
const THUMBNAIL_WIDTH = 120;
const COMPACT_WIDTH = 220;

// keep-comment: a sibling right after an <Image> in a relative parent; mock images only
export default function ExampleImageOverlay({ source, variant = "badge" }: Props) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);

  const label = t(asTranslationKey("common.exampleImage"));

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  if (!isMockImage(source)) return null;

  // keep-comment: nothing before the first layout, so a thumbnail never flashes a full-size badge
  return (
    <View testID="example-image-overlay" style={s.fill} pointerEvents="none" onLayout={onLayout}>
      {width > 0 &&
        (variant === "watermark" ? (
          <View testID="example-image-watermark" style={s.watermarkFill}>
            <Text style={[s.watermarkText, { fontSize: watermarkFontSize(width) }]} allowFontScaling={false}>
              {label}
            </Text>
          </View>
        ) : width < THUMBNAIL_WIDTH ? (
          <View testID="example-image-ribbon" style={s.ribbon}>
            <Text
              style={s.ribbonText}
              numberOfLines={1}
              allowFontScaling={false}
              accessibilityLabel={label}
              adjustsFontSizeToFit
            >
              {t(asTranslationKey("common.exampleImageShort"))}
            </Text>
          </View>
        ) : (
          <View testID="example-image-badge" style={[s.badge, width < COMPACT_WIDTH && s.badgeCompact]}>
            <Text
              style={[s.badgeText, width < COMPACT_WIDTH && s.badgeTextCompact]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {label}
            </Text>
          </View>
        ))}
    </View>
  );
}

function watermarkFontSize(width: number) {
  return Math.max(10, Math.min(28, Math.round(width * 0.11)));
}

const s = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
  },
  badge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeCompact: {
    top: 4,
    left: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  badgeTextCompact: {
    fontSize: 9,
    letterSpacing: 0,
    lineHeight: 12,
  },
  ribbon: {
    position: "absolute",
    left: 3,
    right: 3,
    bottom: 3,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingVertical: 1,
    alignItems: "center",
  },
  ribbonText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
    lineHeight: 11,
    textAlign: "center",
  },
  watermarkFill: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  watermarkText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontWeight: "800",
    letterSpacing: 1,
    transform: [{ rotate: "-20deg" }],
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
