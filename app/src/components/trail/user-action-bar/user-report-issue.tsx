import { authStateAtom } from "@/atoms/auth-atoms";
import NotAuthenticatedDialog from "@/components/auth/not-authenticated-msg-dialog";
import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import TrailObstacleForm from "../obstacle/trail-obstacle-form";

interface Props {
  trailIdentifier: string;
}

export default function UserReportIssue({ trailIdentifier }: Props) {
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);
  const [showForm, setShowForm] = useState(false);
  const [showAuthDialog, setAuthDialog] = useState(false);
  const queryClient = useQueryClient();

  function handlePress() {
    if (!authState.isAuthenticated) {
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
        <Text style={[s.text, { color: theme.colors.onSurface }]}>Rapportera</Text>
      </Pressable>
      <TrailObstacleForm trailIdentifier={trailIdentifier} visible={showForm} onDismiss={handleReportAdded} />
      <NotAuthenticatedDialog
        visible={showAuthDialog}
        onDissmiss={() => setAuthDialog(false)}
        infoMessage="Du behöver vara inloggad för att rapportera en händelse."
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
