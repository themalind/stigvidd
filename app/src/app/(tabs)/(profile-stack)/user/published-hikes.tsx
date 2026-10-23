// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { withdrawHikeSubmission } from "@/api/hike-submissions";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import AlertDialog from "@/components/alert-dialog";
import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import LikeCount from "@/components/like-count";
import LoadingIndicator from "@/components/loading-indicator";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { HikeSubmission, HikeSubmissionStatus } from "@/data/types";
import { HIKE_SUBMISSIONS_QUERY_ROOT, useMyHikeSubmissions } from "@/hooks/hike/useMyHikeSubmissions";
import { formatDate } from "@/utils/format-date";
import { formatDistanceKm } from "@/utils/format-distance";
import { guardedNavigate } from "@/utils/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Icon, MD3Theme, Text, useTheme } from "react-native-paper";

function statusColors(status: HikeSubmissionStatus, theme: MD3Theme) {
  switch (status) {
    case "Approved":
      return { background: theme.colors.primaryContainer, text: theme.colors.onPrimaryContainer };
    case "Rejected":
      return { background: theme.colors.errorContainer, text: theme.colors.onErrorContainer };
    default:
      return { background: theme.colors.tertiaryContainer, text: theme.colors.onTertiaryContainer };
  }
}

interface RowProps {
  submission: HikeSubmission;
  onWithdraw: (submission: HikeSubmission) => void;
}

function SubmissionRow({ submission, onWithdraw }: RowProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const colors = statusColors(submission.status, theme);
  const published = submission.status === "Approved" && submission.publishedTrailIdentifier;
  const date =
    submission.status === "Approved" && submission.decidedAt
      ? t("publish.publishedOn", { date: formatDate(submission.decidedAt) })
      : t("publish.submittedOn", { date: formatDate(submission.createdAt) });

  const openTrail = () => {
    if (!submission.publishedTrailIdentifier) return;
    const identifier = submission.publishedTrailIdentifier;
    guardedNavigate(() =>
      router.navigate({ pathname: "/(tabs)/(profile-stack)/trail/[identifier]", params: { identifier } }),
    );
  };

  return (
    <Pressable
      testID={`submission-${submission.identifier}`}
      disabled={!published}
      onPress={openTrail}
      style={[s.card, { backgroundColor: theme.colors.surface }]}
    >
      <View style={s.row}>
        {submission.imageUrl ? (
          <Image source={{ uri: submission.imageUrl }} style={s.thumbnail} contentFit="cover" />
        ) : (
          <View style={[s.thumbnail, { backgroundColor: theme.colors.surfaceVariant }]} />
        )}
        <View style={s.flex}>
          <Text style={s.name} numberOfLines={1}>
            {submission.name}
          </Text>
          <View style={s.statusRow}>
            <Text style={[s.status, { backgroundColor: colors.background, color: colors.text }]}>
              {t(`publish.status.${submission.status}`)}
            </Text>
            {submission.status === "Approved" && <LikeCount count={submission.likeCount} />}
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {`${formatDistanceKm(submission.trailLength)} · ${date}`}
          </Text>
        </View>
        {published && <Icon source="chevron-right" size={20} />}
      </View>
      {submission.status === "Rejected" && submission.rejectionReason && (
        <Text style={[s.reason, { backgroundColor: theme.colors.background }]}>
          <Text style={s.bold}>{`${t("publish.fromStigvidd")} `}</Text>
          {submission.rejectionReason}
        </Text>
      )}
      {submission.status !== "Approved" && (
        <Pressable
          testID={`submission-withdraw-${submission.identifier}`}
          style={s.withdraw}
          onPress={() => onWithdraw(submission)}
          accessibilityRole="button"
        >
          <Text style={{ color: theme.colors.error }}>{t("publish.withdraw")}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export default function PublishedHikesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setErrorMsg = useSetAtom(showErrorAtom);
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const [toWithdraw, setToWithdraw] = useState<HikeSubmission | null>(null);
  const { data, isLoading, isError, error, refetch } = useMyHikeSubmissions();

  const withdraw = useMutation({
    mutationFn: (submission: HikeSubmission) => withdrawHikeSubmission(submission.identifier),
    onSuccess: () => {
      setSuccessMsg(t("publish.withdrawn"));
      queryClient.invalidateQueries({ queryKey: [HIKE_SUBMISSIONS_QUERY_ROOT] });
    },
    onError: () => setErrorMsg(t("hike.genericError")),
    onSettled: () => setToWithdraw(null),
  });

  if (isLoading) return <LoadingIndicator />;

  // keep-comment: a failed refetch keeps the cached data, so the error screen is only for having nothing to show
  if (isError && !data) return <ErrorView error={error} onRetry={refetch} />;

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <View style={s.header}>
        <BackButton />
        <Icon source="upload" size={24} color={theme.colors.tertiary} />
        <Text style={s.title}>{t("profile.myPublishedHikes")}</Text>
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.identifier}
        contentContainerStyle={s.list}
        renderItem={({ item }) => <SubmissionRow submission={item} onWithdraw={setToWithdraw} />}
        ListEmptyComponent={<Text style={s.empty}>{t("publish.empty")}</Text>}
      />
      <AlertDialog
        visible={toWithdraw !== null}
        onDismiss={() => setToWithdraw(null)}
        title={t("publish.withdrawTitle")}
        infoText={[t("publish.withdrawConfirm")]}
        textColor={theme.colors.onSurface}
        confirmText={t("publish.withdraw")}
        cancelText={t("common.cancel")}
        onConfirm={() => toWithdraw && withdraw.mutate(toWithdraw)}
        backgroundColor={theme.colors.surface}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: SCREEN_PADDING,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  list: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 30,
    gap: 10,
  },
  card: {
    padding: 10,
    gap: 8,
    borderRadius: BORDER_RADIUS,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS,
  },
  flex: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  status: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  reason: {
    padding: 10,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  bold: {
    fontFamily: "Inter_600SemiBold",
  },
  withdraw: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  empty: {
    textAlign: "center",
    marginTop: 40,
    opacity: 0.7,
  },
});
