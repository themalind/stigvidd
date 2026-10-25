// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogFrame from "@/components/dialog/dialog-frame";
import HikeListRow from "@/components/hike/hike-list-row";
import { Hike } from "@/data/types";
import { useMyHikes } from "@/hooks/hike/useMyHikes";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

const newestFirst = (hikes: Hike[]) => [...hikes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

interface Props {
  visible: boolean;
  nickName: string;
  onDismiss: () => void;
  onPick: (hike: Hike) => void;
}

export default function PickHikeDialog({ visible, nickName, onDismiss, onPick }: Props) {
  const { t } = useTranslation();
  const { data: hikes, isLoading } = useMyHikes(newestFirst);

  return (
    <DialogFrame
      testID="pick-hike-dialog"
      visible={visible}
      onDismiss={onDismiss}
      title={t("friends.shareHikeWith", { name: nickName })}
      icon="share-variant-outline"
      showClose
      actions={[]}
    >
      {isLoading ? (
        <ActivityIndicator style={s.status} />
      ) : !hikes?.length ? (
        <Text variant="bodyMedium" style={s.status}>
          {t("friends.noHikesToShare")}
        </Text>
      ) : (
        <View style={s.list}>
          {hikes.map((hike) => (
            <HikeListRow
              key={hike.identifier}
              testID={`pick-hike-${hike.identifier}`}
              identifier={hike.identifier}
              name={hike.name}
              coordinates={hike.coordinates ?? ""}
              imageUrl={hike.images[0]?.imageUrl}
              hikeLength={hike.hikeLength}
              duration={hike.duration}
              date={hike.createdAt}
              onPress={() => onPick(hike)}
            />
          ))}
        </View>
      )}
    </DialogFrame>
  );
}

const s = StyleSheet.create({
  status: {
    paddingVertical: 24,
    textAlign: "center",
    opacity: 0.7,
  },
  list: {
    marginHorizontal: -16,
  },
});
