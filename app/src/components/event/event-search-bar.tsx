// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import FilterChip from "@/components/filter/filter-chip";
import SearchField from "@/components/form/search-field";
import { EventSearch } from "@/hooks/events/useEventSearch";
import { EventWhen } from "@/utils/event/event-search";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  search: EventSearch;
  // Past lists have no date choice, so their quick filters leave it out too. keep-comment: matches the sheet
  showWhen: boolean;
};

export default function EventSearchBar({ search, showWhen }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { text, setText, filters, update, reset, hasLocation, isActive } = search;

  const toggleWhen = (when: EventWhen) => update({ when: filters.when === when ? undefined : when });

  return (
    <View style={s.container}>
      <SearchField
        testID="events-search"
        placeholder={t("events.search.placeholder")}
        value={text}
        onChangeText={setText}
        autoCorrect={false}
        style={s.field}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {showWhen ? (
          <>
            <FilterChip
              testID="events-chip-today"
              label={t("events.search.today")}
              selected={filters.when === "today"}
              onPress={() => toggleWhen("today")}
            />
            <FilterChip
              testID="events-chip-weekend"
              label={t("events.search.weekend")}
              selected={filters.when === "weekend"}
              onPress={() => toggleWhen("weekend")}
            />
          </>
        ) : null}
        {hasLocation ? (
          <FilterChip
            testID="events-chip-near-me"
            label={t("events.search.nearMe")}
            selected={filters.nearMe}
            onPress={() => update({ nearMe: !filters.nearMe })}
          />
        ) : null}
        <FilterChip
          testID="events-chip-spots"
          label={t("events.search.onlyWithSpots")}
          selected={filters.onlyWithSpots}
          onPress={() => update({ onlyWithSpots: !filters.onlyWithSpots })}
        />
      </ScrollView>
      {isActive ? (
        <Pressable testID="events-clear-filters" accessibilityRole="button" onPress={reset} style={s.clear}>
          <Text style={[s.clearText, { color: theme.colors.tertiary }]}>{t("events.search.clearFilters")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 8,
    marginBottom: 6,
  },
  field: {
    height: 44,
  },
  chips: {
    gap: 8,
  },
  clear: {
    alignSelf: "flex-end",
  },
  clearText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
