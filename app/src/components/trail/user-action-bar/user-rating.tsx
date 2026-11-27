// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ReviewEditor from "@/components/review/review-editor";
import { Trail } from "@/data/types";
import { useHasReviewedTrail } from "@/hooks/review/useHasReviewedTrail";
import { useReviewEditor } from "@/hooks/review/useReviewEditor";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

interface UserRatingProps {
  trail: Trail;
}

export default function UserRating({ trail }: UserRatingProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { data: hasReviewed } = useHasReviewedTrail(trail.identifier);
  const editor = useReviewEditor(trail.identifier);

  const onPress = () => {
    if (hasReviewed) void editor.openOwn();
    else editor.openCreate();
  };

  return (
    <View style={s.container}>
      <Pressable onPress={onPress} disabled={editor.isLoading} style={s.pressable}>
        <MaterialIcons
          name={hasReviewed ? "thumb-up-alt" : "thumb-up-off-alt"}
          size={30}
          color={theme.colors.onSurface}
        />
        <Text style={[s.text, { color: theme.colors.onSurface }]}>
          {hasReviewed ? t("review.rated") : t("review.rate")}
        </Text>
      </Pressable>
      <ReviewEditor trail={trail} editor={editor} notAuthMessage={t("review.notAuthRating")} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "column",
  },
  pressable: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 12,
  },
});
