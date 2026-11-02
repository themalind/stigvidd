// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Tag from "@/components/tag";
import { EventVisibility } from "@/data/types";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import EventVisibilityChip from "./event-visibility-chip";

type Props = {
  visibility: EventVisibility;
  isPast: boolean;
};

export default function EventTags({ visibility, isPast }: Props) {
  const { t } = useTranslation();

  return (
    <View style={s.row}>
      <EventVisibilityChip visibility={visibility} />
      {isPast ? <Tag testID="event-past-tag" tone="secondary" icon="history" label={t("events.pastTag")} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
