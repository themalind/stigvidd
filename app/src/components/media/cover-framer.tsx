// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { coverOverflow, focusAfterDrag, ImageSize } from "@/components/media/cover-focus";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GestureResponderEvent, LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Text } from "react-native-paper";

type Props = {
  uri: string;
  aspect: number;
  // 0 shows the top of the image, 1 the bottom. keep-comment: the server's AspectCrop FocusY
  focusY: number;
  onFocusChange: (focusY: number) => void;
  onDragChange?: (dragging: boolean) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
};

const STEP = 0.1;
const CHIP_BACKGROUND = "rgba(25, 25, 25, 0.72)";

// Shows an image in a fixed-aspect frame and lets the user drag which band of it shows. keep-comment: the frame is what every screen shows
export default function CoverFramer({
  uri,
  aspect,
  focusY,
  onFocusChange,
  onDragChange,
  style,
  testID,
  children,
}: Props) {
  const { t } = useTranslation();
  const [frameWidth, setFrameWidth] = useState(0);
  const [size, setSize] = useState<ImageSize | null>(null);
  const [dragFocus, setDragFocus] = useState<number | null>(null);
  const start = useRef({ pageY: 0, focus: focusY });

  const overflow = size ? coverOverflow(frameWidth, size, aspect) : 0;
  const movable = overflow > 0;
  const focus = dragFocus ?? focusY;
  const shownHeight = movable && size ? (frameWidth * size.height) / size.width : 0;
  const placed = movable ? { top: -focus * overflow, left: 0, right: 0, height: shownHeight } : null;

  const finish = () => {
    if (dragFocus !== null) onFocusChange(dragFocus);
    setDragFocus(null);
    onDragChange?.(false);
  };

  const nudge = (delta: number) => onFocusChange(Math.min(1, Math.max(0, focusY + delta)));

  return (
    <View
      testID={testID}
      onLayout={(e: LayoutChangeEvent) => setFrameWidth(e.nativeEvent.layout.width)}
      style={[{ aspectRatio: aspect, zIndex: dragFocus === null ? 0 : 1 }, style]}
    >
      {dragFocus !== null && placed ? (
        <Image
          testID={testID ? `${testID}-ghost` : undefined}
          source={{ uri }}
          pointerEvents="none"
          style={[s.positioned, placed, s.ghost]}
          contentFit="fill"
        />
      ) : null}
      <View
        testID={testID ? `${testID}-frame` : undefined}
        style={s.clip}
        accessible={movable}
        accessibilityRole={movable ? "adjustable" : undefined}
        accessibilityLabel={movable ? t("common.imageFraming") : undefined}
        accessibilityHint={movable ? t("common.imageFramingHint") : undefined}
        accessibilityValue={movable ? { min: 0, max: 100, now: Math.round(focus * 100) } : undefined}
        accessibilityActions={movable ? [{ name: "increment" }, { name: "decrement" }] : undefined}
        onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? STEP : -STEP)}
        onStartShouldSetResponder={() => movable}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e: GestureResponderEvent) => {
          start.current = { pageY: e.nativeEvent.pageY, focus: focusY };
          setDragFocus(focusY);
          onDragChange?.(true);
        }}
        onResponderMove={(e: GestureResponderEvent) =>
          setDragFocus(focusAfterDrag(start.current.focus, e.nativeEvent.pageY - start.current.pageY, overflow))
        }
        onResponderRelease={finish}
        onResponderTerminate={finish}
      >
        <Image
          testID={testID ? `${testID}-image` : undefined}
          source={{ uri }}
          onLoad={(e) => setSize({ width: e.source.width, height: e.source.height })}
          style={placed ? [s.positioned, placed] : StyleSheet.absoluteFill}
          contentFit={placed ? "fill" : "cover"}
        />
        {movable ? (
          <View style={s.hint} pointerEvents="none">
            <MaterialCommunityIcons name="arrow-up-down" size={16} color="#ffffff" />
            <Text style={s.hintText}>{t("common.dragToMove")}</Text>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFill,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  positioned: {
    position: "absolute",
  },
  ghost: {
    opacity: 0.35,
  },
  hint: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BORDER_RADIUS,
    backgroundColor: CHIP_BACKGROUND,
  },
  hintText: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
