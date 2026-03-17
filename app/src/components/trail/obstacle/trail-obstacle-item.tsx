import { addSolvedVote } from "@/api/trail-obstacles";
import { authStateAtom } from "@/atoms/auth-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import AlertDialog from "@/components/alert-dialog";
import NotAuthenticatedDialog from "@/components/auth/not-authenticated-msg-dialog";
import { BORDER_RADIUS } from "@/constants/constants";
import { TrailObstacle } from "@/data/types";
import { formatDate } from "@/utils/format-date";
import issueTypeParser from "@/utils/issue-type-parser";
import { MaterialIcons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";

interface Props {
  obstacle: TrailObstacle;
  trailIdentifier: string;
}

export default function TrailObstacleItem({ obstacle, trailIdentifier }: Props) {
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);
  const { data: stigviddUser } = useAtomValue(stigviddUserAtom);
  const [showAuthDialog, setAuthDialog] = useState(false);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => addSolvedVote(obstacle.identifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obstacles", trailIdentifier] });
    },
  });

  const hasVoted = obstacle.solvedVotes?.some((v) => v.userIdentifier === stigviddUser?.identifier);

  const handlePress = () => {
    if (!authState.isAuthenticated) {
      setAuthDialog(true);
      return;
    }
    setShowVoteDialog(true);
  };

  function handleConfirm() {
    mutate();
    setShowVoteDialog(false);
  }

  return (
    <View style={[s.container, { borderColor: theme.colors.outlineVariant }]}>
      <View style={s.row}>
        <Text style={s.bold}>Kategori: </Text>
        <Text>{issueTypeParser(obstacle.issueType)}</Text>
      </View>
      <Divider bold />
      <View>
        <Text style={s.bold}>Beskrivning: </Text>
        <Text>{obstacle.description}</Text>
      </View>
      <View style={s.footer}>
        <View style={s.row}>
          <Text style={s.bold}>Datum: </Text>
          <Text>{formatDate(obstacle.createdAt)}</Text>
        </View>
        <View style={s.voteRow}>
          <Text style={s.voteCount}>{obstacle.solvedVotes?.length ?? 0}/3</Text>
          <Pressable hitSlop={12} onPress={handlePress} disabled={isPending || hasVoted}>
            <MaterialIcons
              size={24}
              name={hasVoted ? "check-circle" : "radio-button-unchecked"}
              color={isPending ? theme.colors.outline : theme.colors.tertiary}
            />
          </Pressable>
        </View>
      </View>
      <NotAuthenticatedDialog
        visible={showAuthDialog}
        onDissmiss={() => setAuthDialog(false)}
        infoMessage="Du behöver vara inloggad för att markera ett hinder som löst."
      />
      <AlertDialog
        visible={showVoteDialog}
        onDismiss={() => setShowVoteDialog(false)}
        title="Hinder åtgärdat"
        infoText={[
          "Vill du markera detta hinder som löst?",
          "När du markerar som åtgärdat intygar du att hindret inte längre finns kvar. Vill du fortsätta?",
        ]}
        onConfirm={handleConfirm}
        confirmText="Ok"
        cancelText="Avbryt"
        backgroundColor={theme.colors.surface}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: BORDER_RADIUS,
    padding: 10,
    gap: 5,
  },
  row: {
    flexDirection: "row",
  },
  bold: {
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  voteCount: {
    opacity: 0.6,
    fontSize: 12,
  },
});
