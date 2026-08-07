import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { asTranslationKey } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Divider, Text, TextInput, useTheme } from "react-native-paper";
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
          <Pressable onPress={() => setSearchOpen((v) => !v)} hitSlop={16}>
            <MaterialIcons name="search" size={24} color={theme.colors.onBackground} />
          </Pressable>
          <Pressable onPress={() => setSortOpen((v) => !v)} hitSlop={8}>
            <MaterialIcons name="filter-list" size={24} color={theme.colors.onBackground} />
            {activeFilterCount > 0 && (
              <View style={[s.badge, { backgroundColor: theme.colors.primary }]}>
                <Text style={[s.badgeText, { color: theme.colors.onPrimary }]}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
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
            // Collapse on blur, not on every deleted character.
            onBlur={() => {
              if (!searchQuery) setSearchOpen(false);
            }}
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

      {/* Sort menu, following map-filter-menu's pattern. Absolutely positioned so
          opening it does not push the list down. */}
      {sortOpen && (
        <Animated.View
          entering={FadeInUp.duration(150)}
          exiting={FadeOutUp.duration(120)}
          style={[
            s.popover,
            { backgroundColor: theme.colors.elevation.level3, borderColor: theme.colors.outlineVariant },
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
    position: "absolute",
    top: 40,
    right: SCREEN_PADDING,
    zIndex: 10,
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
    // …and Android's, which also fixes stacking (it ignores zIndex).
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
