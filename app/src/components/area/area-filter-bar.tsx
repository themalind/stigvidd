// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import FilterChip from "@/components/filter/filter-chip";
import SearchField from "@/components/form/search-field";
import { BORDER_RADIUS, SLIM_BUTTON_HEIGHT } from "@/constants/constants";
import { AREA_FEATURES, AreaFeature, AreaFilters } from "@/utils/area/area-list";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icon, Menu, Text, useTheme } from "react-native-paper";

interface Props {
  filters: AreaFilters;
  municipalities: string[];
  // keep-comment: without a position the API's order is popularity, so the first sort is named for that
  hasPosition: boolean;
  onChange: (filters: AreaFilters) => void;
}

export default function AreaFilterBar({ filters, municipalities, hasPosition, onChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const set = (change: Partial<AreaFilters>) => onChange({ ...filters, ...change });
  const toggle = (feature: AreaFeature) =>
    set({
      features: filters.features.includes(feature)
        ? filters.features.filter((f) => f !== feature)
        : [...filters.features, feature],
    });
  const chooseMunicipality = (municipality: string | null) => {
    setMenuOpen(false);
    set({ municipality });
  };

  return (
    <View style={s.bar}>
      <SearchField
        testID="area-search"
        value={filters.search}
        onChangeText={(search) => set({ search })}
        placeholder={t("area.searchPlaceholder")}
        dense
      />
      <View style={s.sortRow}>
        <FilterChip
          testID="area-sort-near"
          label={hasPosition ? t("area.sortNear") : t("area.sortPopular")}
          selected={filters.sort === "near"}
          onPress={() => set({ sort: "near" })}
        />
        <FilterChip
          testID="area-sort-az"
          label={t("area.sortAz")}
          selected={filters.sort === "az"}
          onPress={() => set({ sort: "az" })}
        />
        {municipalities.length > 1 && (
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchorPosition="bottom"
            anchor={
              <Pressable
                testID="area-municipality"
                accessibilityRole="button"
                onPress={() => setMenuOpen(true)}
                style={[
                  s.menuButton,
                  { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface },
                ]}
              >
                <Text style={[s.menuLabel, { color: theme.colors.onSurface }]} numberOfLines={1}>
                  {filters.municipality ?? t("area.allMunicipalities")}
                </Text>
                <Icon source="chevron-down" size={16} color={theme.colors.onSurface} />
              </Pressable>
            }
          >
            <Menu.Item
              testID="area-municipality-all"
              title={t("area.allMunicipalities")}
              onPress={() => chooseMunicipality(null)}
            />
            {municipalities.map((municipality) => (
              <Menu.Item
                key={municipality}
                testID={`area-municipality-${municipality}`}
                title={municipality}
                onPress={() => chooseMunicipality(municipality)}
              />
            ))}
          </Menu>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {AREA_FEATURES.map((feature) => (
          <FilterChip
            key={feature}
            testID={`area-feature-${feature}`}
            label={t(`area.feature.${feature}`)}
            selected={filters.features.includes(feature)}
            onPress={() => toggle(feature)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    gap: 10,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuButton: {
    marginLeft: "auto",
    height: SLIM_BUTTON_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
    maxWidth: 170,
  },
  menuLabel: {
    fontSize: 13,
    flexShrink: 1,
  },
  chips: {
    gap: 6,
  },
});
