// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { showWarningAtom } from "@/atoms/snackbar-atoms";
import NotAuthenticatedDialog from "@/components/auth/not-authenticated-msg-dialog";
import AddReview from "@/components/review/add/add-review-modal";
import { Trail } from "@/data/types";
import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/components/auth/auth-provider";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useHasReviewedTrail } from "@/hooks/review/useHasReviewedTrail";

interface UserRatingProps {
  trail: Trail;
}

export default function UserRating({ trail }: UserRatingProps) {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [showAuthDialog, setAuthDialog] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();
  const setWarning = useSetAtom(showWarningAtom);
  const { data: hasReviewed } = useHasReviewedTrail(trail.identifier);

  const onPress = () => {
    if (!isAuthenticated) {
      setAuthDialog(true);
      return;
    }
    // Editing an existing review is not built yet.
    if (hasReviewed) {
      setWarning(t("review.alreadyReviewed"));
      return;
    }
    setShowModal(true);
  };

  const handleReviewAdded = () => {
    setShowModal(false);
    queryClient.invalidateQueries({ queryKey: ["trail", trail.identifier] });
  };

  return (
    <View style={s.container}>
      <Pressable onPress={onPress} style={s.pressable}>
        <MaterialIcons
          name={hasReviewed ? "thumb-up-alt" : "thumb-up-off-alt"}
          size={30}
          color={theme.colors.onSurface}
        />
        <Text style={[s.text, { color: theme.colors.onSurface }]}>
          {hasReviewed ? t("review.rated") : t("review.rate")}
        </Text>
      </Pressable>
      <AddReview
        trailIdentifier={trail.identifier}
        trailName={trail.name}
        trailLength={trail.trailLength}
        visible={showModal}
        onDismiss={handleReviewAdded}
      />
      <NotAuthenticatedDialog
        visible={showAuthDialog}
        onDissmiss={() => setAuthDialog(false)}
        infoMessage={t("review.notAuthRating")}
      />
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
