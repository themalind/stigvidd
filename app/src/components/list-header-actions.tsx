// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { asTranslationKey } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dimensions, Keyboard, Platform, Pressable, StyleSheet, View } from "react-native";
import { Divider, Portal, Text, TextInput, useTheme } from "react-native-paper";
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
}

// Compact filter controls for the profile lists: two icons inside the existing header
// row that expand into a search field or a sort menu. Fully controlled — all filter
// state lives in the caller's useTrailFilters/useHikeFilters.
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
}: ListHeaderActionsProps) {
  // Panel visibility only — no filter state lives here.
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const anchorRef = useRef<View>(null);
  // Window coordinates of the sort menu, measured off the icon each time it opens.
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  // The two panels occupy the same slot under the header, so only one may be open.
  const toggleSearch = () => {
    setSortOpen(false);
    setSearchOpen((v) => !v);
  };

  const toggleSort = () => {
    if (sortOpen) {
      setSortOpen(false);
      return;
    }
    // Dismissing the keyboard blurs the search field, which collapses it.
    Keyboard.dismiss();
    setSearchOpen(false);
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      // Both values in one callback, so the menu never renders at a stale position.
      setMenuPos({ top: y + height + 8, right: Dimensions.get("window").width - (x + width) });
      setSortOpen(true);
    });
  };

  // Split on the last dash so field keys containing one survive.
  const splitAt = sortBy.lastIndexOf("-");
  const activeField = sortBy.slice(0, splitAt);
  const activeDirection = sortBy.slice(splitAt + 1);

  const handleSortPress = (field: SortField) => {
    if (field.key === activeField) {
      // Same field twice flips the direction.
      onSortChange(`${field.key}-${activeDirection === "asc" ? "desc" : "asc"}`);
    } else {
      onSortChange(`${field.key}-${field.defaultDirection ?? "asc"}`);
    }
  };

  const theme = useTheme();
  const { t } = useTranslation();
  const hasActive = activeFilterCount > 0 || searchQuery.length > 0;

  return (
    <View>
      <View style={s.headerRow}>
        {children}
        <View style={s.actions}>
          {/* hitSlop, not padding: 24px icons are below the 44px minimum touch target. */}
          <Pressable onPress={toggleSearch} hitSlop={16}>
            {/* Tinted while a query is active, since the collapsed field hides it. */}
            <MaterialIcons
              name="search"
              size={24}
              color={searchQuery ? theme.colors.primary : theme.colors.onBackground}
            />
          </Pressable>

          {/* collapsable={false}: Android may drop a plain wrapper View from the
              native tree, and measureInWindow needs it to exist. */}
          <View ref={anchorRef} collapsable={false}>
            <Pressable onPress={toggleSort} hitSlop={8}>
              <MaterialIcons name="filter-list" size={24} color={theme.colors.onBackground} />
              {activeFilterCount > 0 && (
                <View style={[s.badge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={[s.badgeText, { color: theme.colors.onPrimary }]}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Mounted on demand so autoFocus fires; styled to match the trails tab's search. */}
      {searchOpen && (
        <Animated.View entering={FadeInUp.duration(150)} exiting={FadeOutUp.duration(120)}>
          <TextInput
            mode="outlined"
            dense
            autoFocus
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChangeText={onSearchChange}
            // Collapse on blur, not on every deleted character. A press anywhere
            // outside blurs the field, which is what closes it; the query survives
            // and the tinted search icon plus the counter row keep it visible.
            onBlur={() => setSearchOpen(false)}
            left={<TextInput.Icon icon="magnify" />}
            right={
              <TextInput.Icon
                icon="close"
                onPress={() => {
                  onSearchChange("");
                  setSearchOpen(false);
                }}
              />
            }
            style={[s.search, { backgroundColor: theme.colors.surface }]}
            theme={{ colors: { primary: theme.colors.outlineVariant } }}
          />
        </Animated.View>
      )}

      {/* Portalled, not absolutely positioned inside the header: only a full-screen
          layer can catch presses outside the panel, and on Android touches never
          reach a child drawn outside its parent's bounds. Both the catcher and the
          panel are tied to one boolean, so they cannot end up out of step. */}
      {sortOpen && menuPos && (
        <Portal>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel={t("common.close")}
            onPress={() => setSortOpen(false)}
          />
          <Animated.View
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
                  {/* asTranslationKey: labelKey is a variable, so t() cannot verify it. */}
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

      {/* Only rendered while filtering, so an untouched page keeps its current height. */}
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
    // iOS already gets its inset from the back button; Android does not.
    paddingLeft: Platform.select({ ios: 0, default: SCREEN_PADDING }),
    paddingRight: SCREEN_PADDING,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginLeft: "auto",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  search: {
    marginHorizontal: SCREEN_PADDING,
    marginTop: 8,
  },
  popover: {
    // Positioned in window coordinates inside the Portal; top/right come from the anchor.
    position: "absolute",
    borderRadius: SURFACE_BORDER_RADIUS,
    paddingVertical: 4,
    minWidth: 180,
    // A tinted surface alone is nearly white in light theme — the border is what
    // actually separates the menu from the list behind it.
    borderWidth: StyleSheet.hairlineWidth,
    // iOS shadow…
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    // …and Android's, which draws it above the press catcher (it ignores zIndex).
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
