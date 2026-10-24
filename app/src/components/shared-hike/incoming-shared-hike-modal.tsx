// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { HikeInfoRows, HikeStatsCard } from "@/components/hike/hike-detail-sections";
import { BORDER_RADIUS, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { SharedHike } from "@/data/types";
import CoordinateParser from "@/utils/coordinate-parser";
import { formatDate } from "@/utils/format-date";
import { Fontisto } from "@expo/vector-icons";
import ModalScrim from "@/components/dialog/modal-scrim";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
import RoutePreviewMap from "../map/route-preview-map";

interface Props {
  visible: boolean;
  sharedHike: SharedHike | null;
  onDismiss: () => void;
  onAccept: () => void;
  onReject: () => void;
  isPending?: boolean;
  isLoading?: boolean;
  isError?: boolean;
}

const HEIGHT = Dimensions.get("screen").height;

export default function IncomingSharedHikeModal({
  visible,
  sharedHike,
  onDismiss,
  onAccept,
  onReject,
  isPending,
  isLoading,
  isError,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const coordinates = useMemo(
    () =>
      sharedHike ? CoordinateParser({ data: sharedHike.coordinates ?? "", identifier: sharedHike.hikeIdentifier }) : [],
    [sharedHike],
  );

  return (
    <Portal>
      {visible && <ModalScrim />}
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[s.contentContainerStyle, { backgroundColor: theme.colors.surface }]}
      >
        <Pressable style={s.closeIcon} hitSlop={12} onPress={onDismiss}>
          <Icon size={24} source="close" color={theme.colors.onSurface} />
        </Pressable>
        {isLoading || !sharedHike ? (
          <View style={s.loadingContainer}>
            {isError ? (
              <Text>{t("hike.couldNotFetch")}</Text>
            ) : (
              <ActivityIndicator size="large" color={theme.colors.primary} />
            )}
          </View>
        ) : (
          <>
            <View style={s.hikeNameContainer}>
              <Fontisto name="map" size={20} color={theme.colors.primary} />
              <Text numberOfLines={1} style={[s.hikeName, { color: theme.colors.secondary }]}>
                {sharedHike.hikeName}
              </Text>
              <View style={s.closeButtonSpacer} />
            </View>
            <RoutePreviewMap idPrefix="incoming-hike-share" path={coordinates} style={s.mapContainer} />
            <HikeStatsCard hikeLength={sharedHike.hikeLength} duration={sharedHike.duration} />
            <ScrollView style={s.scrollArea} contentContainerStyle={s.scrollContent} bounces={false}>
              <View style={s.sharedDetails}>
                <View style={s.row}>
                  <Text style={[s.bold, { color: theme.colors.secondary }]}>{t("hike.sharedBy")} </Text>
                  <Text>{sharedHike.sharedByName ?? t("hike.deletedUser")}</Text>
                </View>
                <View style={s.row}>
                  <Text style={[s.bold, { color: theme.colors.secondary }]}>{t("hike.date")} </Text>
                  <Text>{formatDate(sharedHike.sharedAt)}</Text>
                </View>
              </View>
              <HikeInfoRows {...sharedHike} />
            </ScrollView>
            <View style={s.buttonGroup}>
              <Button
                style={s.button}
                mode="contained"
                icon="check"
                onPress={onAccept}
                disabled={isPending}
                loading={isPending}
              >
                {t("hike.accept")}
              </Button>
              <Button style={s.button} mode="outlined" icon="close" onPress={onReject} disabled={isPending}>
                {t("hike.reject")}
              </Button>
            </View>
          </>
        )}
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  contentContainerStyle: {
    justifyContent: "flex-start",
    maxHeight: HEIGHT * 0.9,
    borderRadius: BORDER_RADIUS,
    padding: 15,
    gap: 10,
  },
  closeIcon: {
    position: "absolute",
    top: 15,
    right: 15,
    zIndex: 1,
  },
  closeButtonSpacer: {
    width: 24,
  },
  hikeNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  hikeName: {
    fontSize: 15,
    fontWeight: 700,
    flex: 1,
    minWidth: 0,
  },
  sharedDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  row: {
    flexDirection: "row",
  },
  bold: {
    fontWeight: 700,
  },
  mapContainer: {
    borderWidth: 0.3,
    borderColor: "black",
    height: HEIGHT * 0.3,
    flexShrink: 0,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    gap: 10,
    paddingVertical: 4,
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingTop: 10,
  },
  button: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
  },
  loadingContainer: {
    minHeight: HEIGHT * 0.5,
    justifyContent: "center",
    alignItems: "center",
  },
});
