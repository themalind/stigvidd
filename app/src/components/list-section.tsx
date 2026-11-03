// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import CountBadge, { BADGE_FONT_SIZE, BADGE_SIZE } from "@/components/count-badge";
import { BORDER_RADIUS } from "@/constants/constants";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Fragment, ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";

const DEFAULT_PREVIEW_COUNT = 5;

interface Props<T> {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  items: readonly T[] | undefined;
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  isPending?: boolean;
  isError?: boolean;
  errorText?: string;
  onRetry?: () => void;
  // keep-comment: contract — no emptyText means an empty list renders nothing at all
  emptyText?: string;
  previewCount?: number;
  testID?: string;
  badge?: number;
  badgeLabel?: string;
  // Each item is its own card, so the list drops the shared background and dividers. keep-comment: when to pass it
  plates?: boolean;
}

export default function ListSection<T>({
  title,
  icon,
  items,
  keyOf,
  renderItem,
  isPending = false,
  isError = false,
  errorText,
  onRetry,
  emptyText,
  previewCount = DEFAULT_PREVIEW_COUNT,
  testID,
  badge,
  badgeLabel,
  plates = false,
}: Props<T>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const count = items?.length ?? 0;
  if (!isPending && !isError && count === 0 && !emptyText) return null;

  const shown = expanded ? items : items?.slice(0, previewCount);
  const bare = plates && !isPending && !isError && count > 0;

  return (
    <View testID={testID} style={s.section}>
      <View style={s.header}>
        <MaterialCommunityIcons name={icon} size={18} color={theme.colors.onSurfaceVariant} />
        <Text variant="titleSmall" style={[s.title, { color: theme.colors.onSurfaceVariant }]}>
          {title}
        </Text>
        <CountBadge
          count={badge}
          size={BADGE_SIZE}
          fontSize={BADGE_FONT_SIZE}
          centered
          accessibilityLabel={badgeLabel}
          testID={testID ? `${testID}-badge` : undefined}
        />
      </View>
      <View
        testID={testID ? `${testID}-card` : undefined}
        style={bare ? s.plateList : [s.card, { backgroundColor: theme.colors.surface }]}
      >
        {isPending ? (
          <ActivityIndicator style={s.loader} />
        ) : isError ? (
          <>
            {errorText && <EmptyText text={errorText} />}
            {onRetry && (
              <Button mode="text" onPress={onRetry} style={s.footerButton}>
                {t("friends.retry")}
              </Button>
            )}
          </>
        ) : count === 0 ? (
          emptyText && <EmptyText text={emptyText} />
        ) : (
          <>
            {shown?.map((item, i) => (
              <Fragment key={keyOf(item)}>
                {i > 0 && !plates && <View style={[s.divider, { backgroundColor: theme.colors.outlineVariant }]} />}
                {renderItem(item)}
              </Fragment>
            ))}
            {count > previewCount && (
              <Button mode="text" onPress={() => setExpanded((v) => !v)} style={s.footerButton}>
                {expanded ? t("friends.showLess") : t("friends.showAll", { count })}
              </Button>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <Text variant="bodyMedium" style={s.emptyText}>
      {text}
    </Text>
  );
}

const s = StyleSheet.create({
  section: {
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  title: {
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  card: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    paddingVertical: 4,
  },
  plateList: {
    gap: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    opacity: 0.55,
  },
  footerButton: {
    marginBottom: 8,
  },
  loader: {
    paddingVertical: 20,
  },
});
