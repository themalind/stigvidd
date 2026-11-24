// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import FilterIconButton from "@/components/filter/filter-icon-button";
import SearchField from "@/components/form/search-field";
import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { asTranslationKey } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { type ComponentRef, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Keyboard, Pressable, StyleSheet, View } from "react-native";
import { Divider, Portal, Text, useTheme } from "react-native-paper";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";

export interface SortField {
  key: string;
  labelKey: string;
  defaultDirection?: "asc" | "desc"; // Direction on first tap; dates want "desc".
}

interface ListHeaderActionsProps {
  children: React.ReactNode; // Left side of the header row: back button, icon, title.
  searchQuery: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  sortFields: SortField[];
  sortBy: string; // "field-direction", e.g. "name-asc" — the hooks' existing format.
  onSortChange: (v: string) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  showingLabel: string; // Pre-translated; the plural key differs per list.
  onClearFilters: () => void;
  showActions?: boolean; // False leaves only the title row.
}

export default function ListHeaderAction({
  children,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  sortFields,
  sortBy,
  onSortChange,
  onOpenFilters,
  activeFilterCount,
  showingLabel,
  onClearFilters,
  showActions = true,
}: ListHeaderActionsProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const anchorRef = useRef<ComponentRef<typeof View>>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  // keep-comment: both panels share one slot, so only one may be open
  const toggleSearch = () => {
    setSortOpen(false);
    setSearchOpen((v) => !v);
  };

  const toggleSort = () => {
    if (sortOpen) {
      setSortOpen(false);
      return;
    }
    // keep-comment: blurring the search field is what collapses it
    Keyboard.dismiss();
    setSearchOpen(false);
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setMenuPos({ top: y + height + 8, right: Dimensions.get("window").width - (x + width) });
      setSortOpen(true);
    });
  };

  // keep-comment: the last dash, so a field key containing one survives
  const splitAt = sortBy.lastIndexOf("-");
  const activeField = sortBy.slice(0, splitAt);
  const activeDirection = sortBy.slice(splitAt + 1);

  const handleSortPress = (field: SortField) => {
    if (field.key === activeField) {
      onSortChange(`${field.key}-${activeDirection === "asc" ? "desc" : "asc"}`);
    } else {
      onSortChange(`${field.key}-${field.defaultDirection ?? "asc"}`);
    }
  };

  const theme = useTheme();
  const { t } = useTranslation();
  const hasActive = activeFilterCount > 0 || searchQuery.length > 0;

  if (!showActions) {
    return (
      <View testID="list-header-row" style={s.headerRow}>
        {children}
      </View>
    );
  }

  return (
    <View>
      <View testID="list-header-row" style={s.headerRow}>
        {children}
        <View style={s.actions}>
          {/* keep-comment: 24px icons are below the 44px minimum touch target */}
          <Pressable onPress={toggleSearch} hitSlop={16}>
            <MaterialIcons
              name="search"
              size={24}
              color={searchQuery ? theme.colors.primary : theme.colors.onBackground}
            />
          </Pressable>

          {/* keep-comment: Android drops a plain wrapper View, and measureInWindow needs it */}
          <View ref={anchorRef} collapsable={false}>
            <FilterIconButton activeCount={activeFilterCount} label={t("filter.label")} onPress={toggleSort} />
          </View>
        </View>
      </View>

      {/* keep-comment: mounted on demand so autoFocus fires */}
      {searchOpen && (
        <Animated.View entering={FadeInUp.duration(150)} exiting={FadeOutUp.duration(120)}>
          <SearchField
            dense
            autoFocus
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChangeText={onSearchChange}
            // keep-comment: the query survives the collapse; the tinted icon and counter row show it
            onBlur={() => setSearchOpen(false)}
            onClear={() => {
              onSearchChange("");
              setSearchOpen(false);
            }}
            style={s.search}
          />
        </Animated.View>
      )}

      {/* keep-comment: portalled, since Android never sends touches to a child outside its parent's bounds */}
      {sortOpen && menuPos && (
        <Portal>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel={t("common.close")}
            onPress={() => setSortOpen(false)}
          />
          <Animated.View
            testID="sort-popover"
            entering={FadeInUp.duration(150)}
            style={[
              s.popover,
              {
                top: menuPos.top,
                right: menuPos.right,
                backgroundColor: theme.colors.elevation.level3,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {sortFields.map((field) => {
              const active = field.key === activeField;
              return (
                <Pressable key={field.key} onPress={() => handleSortPress(field)} style={s.popoverRow}>
                  <Text style={{ color: active ? theme.colors.onSurface : theme.colors.onSurfaceVariant }}>
                    {t(asTranslationKey(field.labelKey))}
                  </Text>
                  {active && (
                    <MaterialIcons
                      name={activeDirection === "asc" ? "arrow-upward" : "arrow-downward"}
                      size={16}
                      color={theme.colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
            <Divider />
            <Pressable
              onPress={() => {
                setSortOpen(false);
                onOpenFilters();
              }}
              style={s.popoverRow}
            >
              <Text style={{ color: theme.colors.onSurface }}>{t("filter.moreFilters")}</Text>
              <MaterialIcons name="chevron-right" size={18} color={theme.colors.onSurfaceVariant} />
            </Pressable>
          </Animated.View>
        </Portal>
      )}

      {hasActive && (
        <View style={s.countRow}>
          <Text variant="bodySmall" style={s.countText}>
            {showingLabel}
          </Text>
          <Pressable onPress={onClearFilters}>
            <Text variant="bodySmall" style={{ color: theme.colors.tertiary }}>
              {t("trailList.clearFilters")}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: SCREEN_PADDING,
    paddingRight: SCREEN_PADDING,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginLeft: "auto",
  },
  search: {
    marginHorizontal: SCREEN_PADDING,
    marginTop: 8,
  },
  popover: {
    position: "absolute",
    borderRadius: SURFACE_BORDER_RADIUS,
    paddingVertical: 4,
    minWidth: 180,
    // keep-comment: the tinted surface is near white in light theme; the border separates it
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    // keep-comment: Android ignores zIndex; elevation draws it above the press catcher
    elevation: 6,
  },
  popoverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 8,
  },
  countText: {
    opacity: 0.6,
  },
});
