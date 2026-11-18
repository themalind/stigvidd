// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS, EVENT_COVER_ASPECT } from "@/constants/constants";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image, ImageSource } from "expo-image";
import { ParseKeys } from "i18next";
import { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

type Props =
  { variant: "explore"; onCreate: () => void } | { variant: "mine"; onCreate: () => void; onExplore: () => void };

type Variant = {
  cover: ImageSource;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  tagKey?: ParseKeys;
  titleKey: ParseKeys;
  bodyKey: ParseKeys;
  createKey: ParseKeys;
};

const VARIANTS: Record<Props["variant"], Variant> = {
  explore: {
    cover: require("../../assets/images/adventure_cover.jpg"),
    icon: "calendar-plus",
    tagKey: "events.emptyCard.tag",
    titleKey: "events.emptyCard.exploreTitle",
    bodyKey: "events.emptyCard.exploreBody",
    createKey: "events.emptyCard.createEvent",
  },
  mine: {
    cover: require("../../assets/images/events_mine_cover.jpg"),
    icon: "compass-outline",
    titleKey: "events.emptyCard.mineTitle",
    bodyKey: "events.emptyCard.mineBody",
    createKey: "events.emptyCard.create",
  },
};

// keep-comment: shaped like an EventCard, but only the buttons are pressable so it is not taken for a real event
export default function EventsEmptyCard(props: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const variant = VARIANTS[props.variant];

  return (
    <View testID={`events-empty-${props.variant}`} style={[s.card, { backgroundColor: theme.colors.surface }]}>
      <Image source={variant.cover} style={s.cover} contentFit="cover" cachePolicy="memory-disk" />
      <View style={s.body}>
        <View style={[s.badge, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons name={variant.icon} size={28} color={theme.colors.onPrimaryContainer} />
        </View>
        <View style={s.text}>
          {variant.tagKey ? <Text style={[s.tag, { color: theme.colors.primary }]}>{t(variant.tagKey)}</Text> : null}
          <Text style={[s.title, { color: theme.colors.onSurface }]}>{t(variant.titleKey)}</Text>
          <Text style={[s.meta, { color: theme.colors.onSurfaceVariant }]}>{t(variant.bodyKey)}</Text>
          <View style={s.actions}>
            {props.variant === "mine" ? (
              <Button testID="events-empty-explore-button" mode="outlined" style={s.button} onPress={props.onExplore}>
                {t("events.emptyCard.explore")}
              </Button>
            ) : null}
            <Button
              testID="events-empty-create-button"
              mode="contained"
              icon="plus"
              style={s.button}
              onPress={props.onCreate}
            >
              {t(variant.createKey)}
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  cover: {
    aspectRatio: EVENT_COVER_ASPECT,
  },
  body: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  badge: {
    width: 52,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  tag: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  meta: {
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
});
