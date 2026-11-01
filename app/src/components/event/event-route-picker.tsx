// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import SheetModal from "@/components/dialog/sheet-modal";
import RouteTrimmer, {
  fullRange,
  lengthOfPath,
  TrimRange,
  trimIndices,
  trimmedPath,
} from "@/components/map/route-trimmer";
import SegmentedControl from "@/components/segmented-control";
import { BORDER_RADIUS } from "@/constants/constants";
import { Hike } from "@/data/types";
import { useMyHikes } from "@/hooks/hike/useMyHikes";
import { useTrailFilters } from "@/hooks/trail/useTrailFilters";
import { useTrails } from "@/hooks/trail/useTrails";
import CoordinateParser from "@/utils/coordinate-parser";
import { EventRouteChoice } from "@/utils/event-form";
import { formatDistanceKm } from "@/utils/format-distance";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Button, Icon, Text, TextInput, useTheme } from "react-native-paper";

type Source = "trail" | "hike";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onPick: (route: EventRouteChoice) => void;
};

export default function EventRoutePicker({ visible, onDismiss, onPick }: Props) {
  const { t } = useTranslation();
  const [source, setSource] = useState<Source>("trail");
  const [trimming, setTrimming] = useState<Hike | null>(null);

  const close = () => {
    setTrimming(null);
    onDismiss();
  };

  const pick = (route: EventRouteChoice) => {
    setTrimming(null);
    onPick(route);
  };

  return (
    <SheetModal
      visible={visible}
      onDismiss={close}
      icon="map-marker-path"
      title={trimming ? t("events.form.trimTitle") : t("events.form.chooseRoute")}
      testID="event-route-picker"
    >
      {trimming ? (
        <HikeTrim hike={trimming} onBack={() => setTrimming(null)} onUse={pick} />
      ) : (
        <View style={s.body}>
          <SegmentedControl
            testID="event-route-source"
            value={source}
            onChange={setSource}
            options={[
              { value: "trail", label: t("events.form.sourceTrail") },
              { value: "hike", label: t("events.form.sourceHike") },
            ]}
          />
          {source === "trail" ? <TrailList onPick={pick} /> : <HikeList onPick={setTrimming} />}
        </View>
      )}
    </SheetModal>
  );
}

function TrailList({ onPick }: { onPick: (route: EventRouteChoice) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { data: trails, isLoading, isError } = useTrails();
  const { filteredTrails: shown, searchQuery: query, setSearchQuery: setQuery } = useTrailFilters(trails, null);

  return (
    <>
      <TextInput
        testID="event-route-search"
        mode="outlined"
        dense
        value={query}
        onChangeText={setQuery}
        placeholder={t("events.form.searchTrail")}
        left={<TextInput.Icon icon="magnify" />}
      />
      <FlatList
        data={shown}
        keyExtractor={(trail) => trail.identifier}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[s.empty, { color: theme.colors.onSurfaceVariant }]}>
            {isLoading ? t("events.form.loading") : isError ? t("events.form.trailsError") : t("events.form.noTrails")}
          </Text>
        }
        renderItem={({ item }) => (
          <PickRow
            testID={`event-route-trail-${item.identifier}`}
            icon="sign-direction"
            primary={item.name}
            secondary={`${item.city} · ${formatDistanceKm(item.trailLength)}`}
            onPress={() =>
              onPick({
                kind: "trail",
                identifier: item.identifier,
                name: item.name,
                lengthMeters: item.trailLength * 1000,
              })
            }
          />
        )}
      />
    </>
  );
}

function HikeList({ onPick }: { onPick: (hike: Hike) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { data: hikes, isLoading, isError } = useMyHikes();
  const withRoute = useMemo(() => (hikes ?? []).filter((hike) => !!hike.coordinates), [hikes]);

  return (
    <>
      <Text style={[s.hint, { color: theme.colors.onSurfaceVariant }]}>{t("events.form.hikeHint")}</Text>
      <FlatList
        data={withRoute}
        keyExtractor={(hike) => hike.identifier}
        ListEmptyComponent={
          <Text style={[s.empty, { color: theme.colors.onSurfaceVariant }]}>
            {isLoading ? t("events.form.loading") : isError ? t("events.form.hikesError") : t("events.form.noHikes")}
          </Text>
        }
        renderItem={({ item }) => (
          <PickRow
            testID={`event-route-hike-${item.identifier}`}
            icon="vector-polyline"
            primary={item.name}
            secondary={formatDistanceKm(item.hikeLength)}
            onPress={() => onPick(item)}
          />
        )}
      />
    </>
  );
}

function HikeTrim({
  hike,
  onBack,
  onUse,
}: {
  hike: Hike;
  onBack: () => void;
  onUse: (route: EventRouteChoice) => void;
}) {
  const { t } = useTranslation();
  const path = useMemo(
    () => CoordinateParser({ data: hike.coordinates ?? "", identifier: hike.identifier }),
    [hike.coordinates, hike.identifier],
  );
  const [trim, setTrim] = useState<TrimRange>(() => fullRange(path));
  const keptPoints = trim[1] - trim[0] + 1;

  const use = () => {
    const { start, end } = trimIndices(path, trim);
    onUse({
      kind: "hike",
      identifier: hike.identifier,
      name: hike.name,
      trimStart: start,
      trimEnd: end,
      lengthMeters: lengthOfPath(trimmedPath(path, trim)),
    });
  };

  return (
    <View style={s.body}>
      <Text style={s.hint}>{t("events.form.trimHint")}</Text>
      <RouteTrimmer idPrefix="event-trim" path={path} trim={trim} onTrimChange={setTrim} />
      <View style={s.actions}>
        <Button mode="text" onPress={onBack}>
          {t("common.back")}
        </Button>
        <Button
          testID="event-trim-use"
          mode="contained"
          disabled={keptPoints < 2}
          onPress={use}
          style={{ borderRadius: BORDER_RADIUS }}
        >
          {t("events.form.useRoute")}
        </Button>
      </View>
    </View>
  );
}

type RowProps = { testID: string; icon: string; primary: string; secondary: string; onPress: () => void };

function PickRow({ testID, icon, primary, secondary, onPress }: RowProps) {
  const theme = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={s.row}>
      <Icon source={icon} size={20} color={theme.colors.primary} />
      <View style={s.rowText}>
        <Text style={{ color: theme.colors.onSurface }} numberOfLines={1}>
          {primary}
        </Text>
        <Text style={[s.secondary, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
          {secondary}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  body: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  hint: {
    fontSize: 13,
  },
  empty: {
    textAlign: "center",
    paddingVertical: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
  },
  rowText: {
    flex: 1,
  },
  secondary: {
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});
