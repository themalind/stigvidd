// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { asTranslationKey } from "@/i18n";
import { isMockImage } from "@/utils/is-mock-image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

type Props = {
  /** The image source being displayed. The badge only renders if this is a mock image. */
  source: unknown;
  /**
   * "badge" = label on the image itself, sized after how much room the image gives it.
   * "watermark" = diagonal, semi-transparent text across the whole image.
   */
  variant?: "badge" | "watermark";
};

/** Narrower than this and a corner pill would cover most of the picture — use a bottom ribbon instead. */
const THUMBNAIL_WIDTH = 120;
/** Below this the pill still fits, but only in a tighter form. */
const COMPACT_WIDTH = 220;

/**
 * Place as a sibling directly after an <Image> inside a parent with
 * `position: "relative"` (and preferably `overflow: "hidden"`).
 * Shows an "Example image" badge — but only for mock images, so it
 * removes itself once real images are uploaded.
 *
 * The overlay stretches to the image it covers and measures itself, so the
 * same component reads well on a full-width hero and on a 60px thumbnail.
 */
export default function ExampleImageOverlay({ source, variant = "badge" }: Props) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);

  const label = t(asTranslationKey("common.exampleImage"));

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  if (!isMockImage(source)) return null;

  // Nothing is drawn until the first layout pass, so a thumbnail never flashes
  // a full-size badge before shrinking it.
  return (
    <View style={s.fill} pointerEvents="none" onLayout={onLayout}>
      {width > 0 &&
        (variant === "watermark" ? (
          <View style={s.watermarkFill}>
            <Text style={[s.watermarkText, { fontSize: watermarkFontSize(width) }]} allowFontScaling={false}>
              {label}
            </Text>
          </View>
        ) : width < THUMBNAIL_WIDTH ? (
          // A ribbon along the bottom edge: it fits any thumbnail width and keeps
          // the picture itself visible. Inset slightly so it stays clear of the
          // image's rounded corners.
          <View style={s.ribbon}>
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
          <View style={[s.badge, width < COMPACT_WIDTH && s.badgeCompact]}>
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

/** Big enough to read as a watermark, small enough to stay inside the image. */
function watermarkFontSize(width: number) {
  return Math.max(10, Math.min(28, Math.round(width * 0.11)));
}

const s = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
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
    ...StyleSheet.absoluteFillObject,
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
