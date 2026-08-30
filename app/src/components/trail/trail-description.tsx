// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { Trail } from "@/data/types";
import { StyleSheet, Text, View } from "react-native";
import { Surface, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface TrailDescriptionProps {
  trail: Trail;
}

export default function TrailDescription({ trail }: TrailDescriptionProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Surface elevation={0} style={[s.container, { backgroundColor: theme.colors.surface }]}>
      <View style={s.descriptionContainer}>
        <Text style={[s.sectionTitle, { color: theme.colors.onSurface }]}>{t("trail.description")}</Text>
        <Text style={[s.description, { color: theme.colors.onSurface }]}>{trail.description}</Text>
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 15,
    padding: 20,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  descriptionContainer: {
    gap: 5,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 15,
  },
  description: {
    flexDirection: "row",
    flexWrap: "wrap",
    fontSize: 15,
    lineHeight: 25,
  },
});
