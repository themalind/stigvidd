import { addSolvedVote, deleteSolvedVote, deleteTrailObstacle } from "@/api/trail-obstacles";
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
import TrailObstacleUpdateForm from "./trail-obstacle-update-form";

interface Props {
  obstacle: TrailObstacle;
  trailIdentifier: string;
  onCloseModal?: () => void;
}

export default function TrailObstacleItem({ obstacle, trailIdentifier, onCloseModal }: Props) {
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);
  const { data: stigviddUser } = useAtomValue(stigviddUserAtom);
  const [showAuthDialog, setAuthDialog] = useState(false);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();
  const hasVoted = obstacle.solvedVotes?.some((v) => v.userIdentifier === stigviddUser?.identifier);
  const isOwner = stigviddUser?.identifier === obstacle.userIdentifier;

  const { mutate, isPending } = useMutation({
    mutationFn: () => addSolvedVote(obstacle.identifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obstacles", trailIdentifier] });
    },
  });

  const { mutate: deleteSolvedVoteMutate, isPending: deleteSolvedVoteIsPending } = useMutation({
    mutationFn: () => deleteSolvedVote(obstacle.identifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obstacles", trailIdentifier] });
    },
  });

  const { mutate: deleteObstacleMutate, isPending: deleteObstacleIsPending } = useMutation({
    mutationFn: (trailObstacleIdentifier: string) => deleteTrailObstacle(trailObstacleIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obstacles", trailIdentifier] });
    },
  });

  const handlePress = () => {
    if (!authState.isAuthenticated) {
      setAuthDialog(true);
      return;
    }

    if (hasVoted) {
      setShowUndoDialog(true);
    } else {
      setShowVoteDialog(true);
    }
  };

  function handleEdit() {
    if (!authState.isAuthenticated) {
      setAuthDialog(true);
      return;
    }
    setShowUpdateForm(true);
  }

  function handleDelete() {
    deleteObstacleMutate(obstacle.identifier);
    setShowDeleteDialog(false);
  }

  function handleAddVote() {
    mutate();
    setShowVoteDialog(false);
  }

  function handleRemoveVote() {
    deleteSolvedVoteMutate();
    setShowUndoDialog(false);
  }

  return (
    <View style={[s.container, { borderColor: theme.colors.outlineVariant }]}>
      <View style={s.categoryRow}>
        <View style={s.field}>
          <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>Kategori</Text>
          <Text style={[s.value, { color: theme.colors.onSurface }]}>{issueTypeParser(obstacle.issueType)}</Text>
        </View>
        {isOwner && (
          <View style={s.ownerActions}>
            <Pressable hitSlop={12} onPress={handleEdit} disabled={deleteObstacleIsPending}>
              <MaterialIcons size={20} name="edit" color={theme.colors.onSurfaceVariant} />
            </Pressable>
            <Pressable hitSlop={12} onPress={() => setShowDeleteDialog(true)} disabled={deleteObstacleIsPending}>
              <MaterialIcons size={20} name="delete-outline" color={theme.colors.onSurface} />
            </Pressable>
          </View>
        )}
      </View>
      <Divider />
      <View style={s.field}>
        <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>Beskrivning</Text>
        <Text style={[s.description, { color: theme.colors.onSurface }]}>{obstacle.description}</Text>
      </View>
      <View style={s.footer}>
        <View style={s.field}>
          <Text style={[s.label, { color: theme.colors.onSurfaceVariant }]}>Datum</Text>
          <Text style={[s.value, { color: theme.colors.onSurface }]}>{formatDate(obstacle.createdAt)}</Text>
        </View>

        <View style={s.voteRow}>
          <Text style={s.voteCount}>{obstacle.solvedVotes?.length ?? 0}/3</Text>
          {!isOwner && (
            <Pressable hitSlop={12} onPress={handlePress} disabled={isPending || deleteSolvedVoteIsPending}>
              <MaterialIcons
                size={24}
                name={hasVoted ? "check-circle" : "radio-button-unchecked"}
                color={isPending ? theme.colors.outline : theme.colors.tertiary}
              />
            </Pressable>
          )}
        </View>
      </View>
      <TrailObstacleUpdateForm
        visible={showUpdateForm}
        onDismiss={() => setShowUpdateForm(false)}
        obstacleIdentifier={obstacle.identifier}
        trailIdentifier={trailIdentifier}
        initialDescription={obstacle.description}
        initialIssueType={obstacle.issueType}
      />
      <AlertDialog
        visible={showDeleteDialog}
        onDismiss={() => setShowDeleteDialog(false)}
        title="Ta bort hinder"
        infoText={["Är du säker på att du vill ta bort den här rapporten?", "Åtgärden kan inte ångras."]}
        onConfirm={handleDelete}
        confirmText="Ta bort"
        cancelText="Avbryt"
        backgroundColor={theme.colors.surface}
        textColor={theme.colors.onSurface}
      />
      <NotAuthenticatedDialog
        visible={showAuthDialog}
        onDissmiss={() => setAuthDialog(false)}
        onBeforeNavigate={onCloseModal}
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
        onConfirm={handleAddVote}
        confirmText="Ok"
        cancelText="Avbryt"
        backgroundColor={theme.colors.surface}
        textColor={theme.colors.onSurface}
      />
      <AlertDialog
        visible={showUndoDialog}
        onDismiss={() => setShowUndoDialog(false)}
        title="Ta bort markering"
        infoText={[
          "Du har redan markerat detta hinder som löst.",
          "Vill du ta bort din markering?",
          "Detta innebär att hindret inte längre räknas som åtgärdat från din sida.",
        ]}
        onConfirm={handleRemoveVote}
        confirmText="Ta bort"
        cancelText="Avbryt"
        backgroundColor={theme.colors.surface}
        textColor={theme.colors.onSurface}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
    padding: 12,
    gap: 10,
  },
  field: {
    gap: 2,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ownerActions: {
    flexDirection: "row",
    gap: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
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
