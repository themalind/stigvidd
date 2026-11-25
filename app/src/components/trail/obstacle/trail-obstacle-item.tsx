// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { addSolvedVote, deleteSolvedVote, deleteTrailObstacle } from "@/api/trail-obstacles";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import AlertDialog from "@/components/dialog/alert-dialog";
import InfoHeading from "@/components/layout/info-heading";
import AccountBannedDialog from "@/components/auth/account-banned-dialog";
import NotAuthenticatedDialog from "@/components/auth/not-authenticated-msg-dialog";
import ReportContentForm from "@/components/report/report-content-form";
import { BORDER_RADIUS } from "@/constants/constants";
import { TrailObstacle } from "@/data/types";
import { useCanWrite } from "@/hooks/auth/useCanWrite";
import { formatDate } from "@/utils/format/format-date";
import issueTypeParser from "@/components/trail/issue-type-parser";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import TrailObstacleUpdateForm from "./trail-obstacle-update-form";
import { useAuth } from "@/components/auth/auth-provider";

interface Props {
  obstacle: TrailObstacle;
  trailIdentifier: string;
  onCloseModal?: () => void;
  // keep-comment: off where a surrounding card already draws the edge
  outlined?: boolean;
  // keep-comment: off where the vote count is already explained above the item, as in the obstacle list
  explainVotes?: boolean;
}

export default function TrailObstacleItem({
  obstacle,
  trailIdentifier,
  onCloseModal,
  outlined = true,
  explainVotes = true,
}: Props) {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const { data: stigviddUser } = useAtomValue(stigviddUserAtom);
  const [showAuthDialog, setAuthDialog] = useState(false);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showBannedDialog, setBannedDialog] = useState(false);
  const { reason } = useCanWrite();
  const queryClient = useQueryClient();
  const hasVoted = obstacle.solvedVotes?.some((v) => v.userIdentifier === stigviddUser?.identifier);
  const isOwner = !!obstacle.userIdentifier && stigviddUser?.identifier === obstacle.userIdentifier;
  const labelStyle = [s.label, { color: theme.colors.onSurfaceVariant }];

  const { mutate, isPending } = useMutation({
    mutationFn: () => addSolvedVote(obstacle.identifier),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["obstacles", trailIdentifier] });
    },
  });

  const { mutate: deleteSolvedVoteMutate, isPending: deleteSolvedVoteIsPending } = useMutation({
    mutationFn: () => deleteSolvedVote(obstacle.identifier),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["obstacles", trailIdentifier] });
    },
  });

  const { mutate: deleteObstacleMutate, isPending: deleteObstacleIsPending } = useMutation({
    mutationFn: (trailObstacleIdentifier: string) => deleteTrailObstacle(trailObstacleIdentifier),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["obstacles", trailIdentifier] });
    },
  });

  const handlePress = () => {
    if (!isAuthenticated) {
      setAuthDialog(true);
      return;
    }

    if (hasVoted) {
      setShowUndoDialog(true);
    } else if (reason === "banned") {
      setBannedDialog(true);
    } else {
      setShowVoteDialog(true);
    }
  };

  function handleEdit() {
    if (!isAuthenticated) {
      setAuthDialog(true);
      return;
    }
    if (reason === "banned") {
      setBannedDialog(true);
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

  function handleReport() {
    if (!isAuthenticated) {
      setAuthDialog(true);
      return;
    }
    setShowReportForm(true);
  }

  function handleRemoveVote() {
    deleteSolvedVoteMutate();
    setShowUndoDialog(false);
  }

  return (
    <View
      testID="obstacle-card"
      style={[s.container, outlined && [s.outlined, { borderColor: theme.colors.outlineVariant }]]}
    >
      <View style={s.content}>
        <View testID="obstacle-header" style={s.categoryRow}>
          <View style={s.field}>
            <Text style={labelStyle}>{t("obstacle.category")}</Text>
            <Text style={[s.value, { color: theme.colors.onSurface }]}>{issueTypeParser(obstacle.issueType)}</Text>
          </View>
          {isOwner ? (
            <View style={s.ownerActions}>
              <Pressable
                hitSlop={12}
                onPress={handleEdit}
                disabled={deleteObstacleIsPending}
                accessibilityRole="button"
                accessibilityLabel={t("obstacle.editTitle")}
              >
                <MaterialIcons size={20} name="edit" color={theme.colors.onSurfaceVariant} />
              </Pressable>
              <Pressable
                hitSlop={12}
                onPress={() => setShowDeleteDialog(true)}
                disabled={deleteObstacleIsPending}
                accessibilityRole="button"
                accessibilityLabel={t("obstacle.deleteTitle")}
              >
                <MaterialIcons size={20} name="delete-outline" color={theme.colors.onSurface} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              testID="report-obstacle-button"
              hitSlop={12}
              onPress={handleReport}
              accessibilityRole="button"
              accessibilityLabel={t("obstacle.reportTitle")}
            >
              <MaterialCommunityIcons size={20} name="alert-circle" color={theme.colors.outline} />
            </Pressable>
          )}
        </View>
        <Divider />
        <View style={s.field}>
          <Text style={labelStyle}>{t("obstacle.description")}</Text>
          {/* keep-comment: trailing newlines from the input would render as blank lines */}
          <Text style={[s.description, { color: theme.colors.onSurface }]}>
            {obstacle.description?.trim() || t("obstacle.removedDescription")}
          </Text>
        </View>
        <View style={s.footer}>
          <View style={s.field}>
            <Text style={labelStyle}>{t("obstacle.date")}</Text>
            <Text style={[s.value, { color: theme.colors.onSurface }]}>{formatDate(obstacle.createdAt)}</Text>
          </View>

          <View testID="obstacle-solved" style={[s.field, s.solvedField]}>
            {explainVotes ? (
              <InfoHeading
                label={t("obstacle.gone")}
                labelStyle={labelStyle}
                infoTitle={t("obstacle.goneInfoTitle")}
                infoHitSlop={INFO_HIT_SLOP}
                // keep-comment: the same text as the box above the obstacle list, so the two never drift apart
                infoIntro={t("obstacle.modalBody")}
              />
            ) : (
              <Text style={labelStyle}>{t("obstacle.gone")}</Text>
            )}
            <View style={s.voteGroup}>
              <Text style={s.voteCount}>{obstacle.solvedVoteCount ?? obstacle.solvedVotes?.length ?? 0}/3</Text>
              {!isOwner && (
                <Pressable
                  testID="vote-button"
                  hitSlop={12}
                  onPress={handlePress}
                  disabled={isPending || deleteSolvedVoteIsPending}
                >
                  <MaterialIcons
                    size={24}
                    name={hasVoted ? "check-circle" : "radio-button-unchecked"}
                    color={isPending ? theme.colors.outline : theme.colors.tertiary}
                  />
                </Pressable>
              )}
            </View>
          </View>
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
        title={t("obstacle.deleteTitle")}
        infoText={[t("obstacle.deleteConfirm")]}
        icon="delete-outline"
        tone="danger"
        irreversible
        onConfirm={handleDelete}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
      />
      <ReportContentForm
        visible={showReportForm}
        contentType="TrailObstacle"
        contentIdentifier={obstacle.identifier}
        invalidateQueryKey={["obstacles", trailIdentifier]}
        onDismiss={() => setShowReportForm(false)}
      />
      <AccountBannedDialog visible={showBannedDialog} onDismiss={() => setBannedDialog(false)} />
      <NotAuthenticatedDialog
        visible={showAuthDialog}
        onDissmiss={() => setAuthDialog(false)}
        onBeforeNavigate={onCloseModal}
        infoMessage={t("obstacle.notAuthVote")}
      />
      <AlertDialog
        visible={showVoteDialog}
        onDismiss={() => setShowVoteDialog(false)}
        title={t("obstacle.fixedTitle")}
        infoText={[t("obstacle.fixedConfirm"), t("obstacle.fixedInfo")]}
        icon="check-circle-outline"
        onConfirm={handleAddVote}
        confirmText={t("common.ok")}
        cancelText={t("common.cancel")}
      />
      <AlertDialog
        visible={showUndoDialog}
        onDismiss={() => setShowUndoDialog(false)}
        title={t("obstacle.undoTitle")}
        infoText={[t("obstacle.undoInfo1"), t("obstacle.undoInfo2"), t("obstacle.undoInfo3")]}
        icon="undo-variant"
        tone="danger"
        onConfirm={handleRemoveVote}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
      />
    </View>
  );
}

// keep-comment: no reach downwards, so a tap just above the vote circle votes instead of opening the info
const INFO_HIT_SLOP = { top: 16, left: 16, right: 16, bottom: 0 };

const s = StyleSheet.create({
  container: {
    padding: 12,
  },
  outlined: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
  },
  content: {
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
  solvedField: {
    alignItems: "flex-end",
    // keep-comment: room between the info button and the vote circle stacked under it, see INFO_HIT_SLOP
    gap: 8,
  },
  voteGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  voteCount: {
    opacity: 0.6,
    fontSize: 12,
  },
});
