// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getFriends, searchUsers } from "@/api/friends";
import { userAtom } from "@/atoms/auth-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { FRIENDS_STALE_TIME, USER_SEARCH_STALE_TIME } from "@/constants/cache";
import { BORDER_RADIUS, MAX_SHARE_RECIPIENTS, MIN_USER_SEARCH_LENGTH } from "@/constants/constants";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useDeferredValue, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Checkbox, Chip, Divider, Icon, Text, TextInput, useTheme } from "react-native-paper";

interface Props {
  enabled: boolean;
  onSubmit: (nickNames: string[]) => void;
  submitLabel: (count: number) => string;
  submitIcon: string;
  emptyText: string;
  limitText: string;
  isPending?: boolean;
  excludeNickNames?: string[];
  initialSelected?: string[];
  limit?: number;
  // Adds a search over every user; selected people stay as chips after the search is cleared. keep-comment: non-friends are only reachable by search
  searchable?: boolean;
  // Taken out of the selection whenever this changes, e.g. accounts the server no longer knows. keep-comment: the selection is the picker's own state
  dropNickNames?: string[];
}

interface Person {
  identifier: string;
  nickName: string;
}

export default function UserPicker({
  enabled,
  onSubmit,
  submitLabel,
  submitIcon,
  emptyText,
  limitText,
  isPending,
  excludeNickNames,
  initialSelected,
  limit = MAX_SHARE_RECIPIENTS,
  searchable = false,
  dropNickNames,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const currentUser = useAtomValue(stigviddUserAtom);
  const authUser = useAtomValue(userAtom);
  const [selected, setSelected] = useState<string[]>(initialSelected ?? []);
  const [appliedDrop, setAppliedDrop] = useState<typeof dropNickNames>(undefined);
  if (dropNickNames !== appliedDrop) {
    setAppliedDrop(dropNickNames);
    if (dropNickNames && dropNickNames.length > 0) {
      setSelected((prev) => prev.filter((nickName) => !dropNickNames.includes(nickName)));
    }
  }
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const searching = searchable && query.length >= MIN_USER_SEARCH_LENGTH;

  const { data: friendsRaw, isLoading } = useQuery({
    // keep-comment: same key as friendsAtom, so the picker and the friends screen share one cache entry
    queryKey: ["friends", authUser?.id],
    queryFn: getFriends,
    enabled,
    staleTime: FRIENDS_STALE_TIME,
  });

  const { data: hitsRaw, isFetching: isSearching } = useQuery({
    // keep-comment: same key as userSearchAtomFamily
    queryKey: ["users", "search", authUser?.id, query],
    queryFn: () => searchUsers(query),
    enabled: enabled && searching,
    staleTime: USER_SEARCH_STALE_TIME,
  });

  const visible = (people: Person[] | undefined) =>
    people?.filter((p) => p.nickName !== currentUser.data?.nickName && !excludeNickNames?.includes(p.nickName));

  const people = searching ? visible(hitsRaw) : visible(friendsRaw);
  const atLimit = selected.length >= limit;

  const toggle = (nickName: string) =>
    setSelected((prev) => (prev.includes(nickName) ? prev.filter((n) => n !== nickName) : [...prev, nickName]));

  const list = () => {
    if (isLoading || (searching && isSearching && !hitsRaw)) {
      return (
        <View style={s.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    if (!people || people.length === 0) {
      return (
        <View style={s.centered}>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{searching ? t("friends.noResults") : emptyText}</Text>
        </View>
      );
    }
    return (
      <ScrollView bounces={false} style={s.flex} keyboardShouldPersistTaps="handled">
        {people.map((item, index) => {
          const checked = selected.includes(item.nickName);
          return (
            <View key={item.identifier}>
              <Pressable
                testID={`user-picker-row-${item.nickName}`}
                style={({ pressed }) => [s.friendItem, pressed && { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={() => toggle(item.nickName)}
                disabled={isPending || (atLimit && !checked)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <Icon size={22} source="account" color={theme.colors.primary} />
                <Text style={s.nickName}>{item.nickName}</Text>
                <Checkbox.Android
                  status={checked ? "checked" : "unchecked"}
                  color={theme.colors.primary}
                  uncheckedColor={theme.colors.onSurfaceVariant}
                />
              </Pressable>
              {index < people.length - 1 && <Divider />}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <>
      {searchable ? (
        <View style={s.searchArea}>
          <TextInput
            testID="user-picker-search"
            mode="outlined"
            dense
            value={search}
            onChangeText={setSearch}
            placeholder={t("friends.search")}
            left={<TextInput.Icon icon="magnify" />}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {selected.length > 0 ? (
            <View style={s.chips}>
              {selected.map((nickName) => (
                <Chip
                  key={nickName}
                  testID={`user-picker-chip-${nickName}`}
                  onClose={() => toggle(nickName)}
                  style={{ borderRadius: BORDER_RADIUS }}
                >
                  {nickName}
                </Chip>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {list()}
      <Divider />
      <View style={s.buttonContainer}>
        {atLimit && <Text style={[s.limitHint, { color: theme.colors.onSurfaceVariant }]}>{limitText}</Text>}
        <Button
          mode="contained"
          icon={submitIcon}
          style={s.button}
          onPress={() => onSubmit(selected)}
          disabled={selected.length === 0 || isPending}
          loading={isPending}
        >
          {submitLabel(selected.length)}
        </Button>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  searchArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
    paddingLeft: 16,
    paddingRight: 8,
  },
  nickName: {
    flex: 1,
    fontSize: 16,
  },
  centered: {
    padding: 30,
    alignItems: "center",
  },
  buttonContainer: {
    padding: 16,
    alignItems: "center",
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
  limitHint: {
    marginBottom: 8,
    textAlign: "center",
  },
  flex: {
    flex: 1,
  },
});
