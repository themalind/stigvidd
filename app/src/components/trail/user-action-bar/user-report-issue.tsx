import NotAuthenticatedDialog from "@/components/auth/not-authenticated-msg-dialog";
import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import TrailObstacleForm from "../obstacle/trail-obstacle-form";
import { useAuth } from "@/components/auth/auth-provider";

interface Props {
  trailIdentifier: string;
}

export default function UserReportIssue({ trailIdentifier }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [showAuthDialog, setAuthDialog] = useState(false);
  const queryClient = useQueryClient();

  function handlePress() {
    if (!isAuthenticated) {
      setAuthDialog(true);
      return;
    }
    setShowForm(true);
  }

  function handleReportAdded() {
    setShowForm(false);
    queryClient.invalidateQueries();
  }

  return (
    <View>
      <Pressable onPress={handlePress} style={s.pressable}>
        <MaterialIcons name="warning-amber" size={30} color={theme.colors.onSurface} />
        <Text style={[s.text, { color: theme.colors.onSurface }]}>{t("obstacle.report")}</Text>
      </Pressable>
      <TrailObstacleForm trailIdentifier={trailIdentifier} visible={showForm} onDismiss={handleReportAdded} />
      <NotAuthenticatedDialog
        visible={showAuthDialog}
        onDissmiss={() => setAuthDialog(false)}
        infoMessage={t("userActions.notAuthReport")}
      />
    </View>
  );
}

const s = StyleSheet.create({
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 12,
  },
});
