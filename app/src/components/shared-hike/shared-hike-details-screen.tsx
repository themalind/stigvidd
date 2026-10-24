// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { hikeRouteQueryKey } from "@/api/hikes";
import { removeSharedHike, reshareHike } from "@/api/shared-hikes";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import AlertDialog from "@/components/alert-dialog";
import AccountBannedDialog from "@/components/auth/account-banned-dialog";
import { useAuth } from "@/components/auth/auth-provider";
import HikeDetailLayout, { HikeDetailFallback } from "@/components/hike/hike-detail-layout";
import HikeImageSection from "@/components/hike/hike-image-section";
import ImageViewer, { ViewerImage } from "@/components/review/image-viewer";
import LoadingIndicator from "@/components/loading-indicator";
import ReportContentForm from "@/components/report/report-content-form";
import ReshareHikeModal from "@/components/shared-hike/reshare-hike-modal";
import { BORDER_RADIUS } from "@/constants/constants";
import { ReshareSharedHikeRequest, SharedHike } from "@/data/types";
import { sharedHikesQueryKey, useSharedHikes } from "@/hooks/shared-hikes/useSharedHikes";
import { useCanWrite } from "@/hooks/useCanWrite";
import { track } from "@/services/analytics";
import { formatDate } from "@/utils/format-date";
import { guardedNavigate } from "@/utils/navigation";
import { ShareFailure, shareFailure } from "@/utils/share-failure";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

const trackReshared = (outcome: "success" | ShareFailure, request: ReshareSharedHikeRequest) =>
  track("hike.shared", {
    kind: "reshare",
    outcome,
    recipientCount: request.reShareToNames.length,
    allowResharing: false,
  });

export default function SharedHikeDetailsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const user = useAtomValue(stigviddUserAtom);
  const setErrorMsg = useSetAtom(showErrorAtom);
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const { reason } = useCanWrite();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBannedDialog, setShowBannedDialog] = useState(false);
  const [removedHike, setRemovedHike] = useState<SharedHike | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [reportedImage, setReportedImage] = useState<ViewerImage | null>(null);

  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const hikeIdentifier: string = Array.isArray(identifier) ? identifier[0] : identifier;

  const {
    data: found,
    isPending,
    isError,
    error,
    refetch,
  } = useSharedHikes(
    useCallback((hikes: SharedHike[]) => hikes.find((h) => h.hikeIdentifier === hikeIdentifier), [hikeIdentifier]),
  );
  // keep-comment: the list drops a removed hike before the pop animation ends, so keep drawing it until then
  const sharedHike = found ?? removedHike;

  const deleteMutation = useMutation({
    mutationFn: (toRemove: SharedHike) => removeSharedHike(toRemove.hikeIdentifier),
    onSuccess: (_, removed) => {
      setRemovedHike(removed);
      setSuccessMsg(t("hike.sharedHikeDeleted"));
      router.back();
      queryClient.invalidateQueries({ queryKey: sharedHikesQueryKey(user.data?.identifier) });
    },
    onError: () => setErrorMsg(t("hike.genericError")),
  });

  const reshareMutation = useMutation({
    mutationFn: (request: ReshareSharedHikeRequest) => reshareHike(request),
    onSuccess: (_, request) => {
      setShowShareModal(false);
      setSuccessMsg(t("hike.shared"));
      trackReshared("success", request);
    },
    onError: (error, request) => {
      setShowShareModal(false);
      const failure = shareFailure(error);
      if (failure === "recipient_unavailable") {
        queryClient.invalidateQueries({ queryKey: ["friends"] });
        setErrorMsg(t("hike.recipientUnavailable"));
      } else if (failure === "not_allowed") {
        setErrorMsg(t("hike.reshareNotAllowed"));
      } else {
        setErrorMsg(t("hike.genericError"));
      }
      trackReshared(failure, request);
    },
  });

  if (!sharedHike) {
    if (!isAuthenticated) return <HikeDetailFallback error={new ApiError("Not signed in", 401)} />;
    if (isError) return <HikeDetailFallback error={error} onRetry={refetch} />;
    if (isPending) return <LoadingIndicator />;
    return <HikeDetailFallback error={new ApiError("Shared hike not found", 404)} />;
  }

  const openFollowMap = () => {
    // keep-comment: the follow screen reads the route from this key, so it paints without a second request
    queryClient.setQueryData(hikeRouteQueryKey(sharedHike.hikeIdentifier), sharedHike.coordinates ?? "");
    guardedNavigate(() =>
      router.navigate({
        pathname: "/(tabs)/(profile-stack)/hike-follow/[identifier]",
        params: { identifier: sharedHike.hikeIdentifier, name: sharedHike.hikeName },
      }),
    );
  };

  return (
    <HikeDetailLayout
      title={sharedHike.hikeName}
      idPrefix="shared-hike"
      hikeIdentifier={sharedHike.hikeIdentifier}
      coordinates={sharedHike.coordinates}
      onOpenMap={openFollowMap}
      hikeLength={sharedHike.hikeLength}
      duration={sharedHike.duration}
      facts={[
        { label: t("hike.sharedByTitle"), value: sharedHike.sharedByName ?? t("hike.deletedUser") },
        { label: t("hike.sharedOn"), value: formatDate(sharedHike.sharedAt) },
      ]}
      info={sharedHike}
      media={<HikeImageSection images={sharedHike.images ?? []} onOpen={setViewerIndex} />}
      actions={
        <View style={s.actionColumn}>
          {!sharedHike.allowResharing && (
            <Text variant="bodySmall" style={[s.resharingNote, { color: theme.colors.onSurfaceVariant }]}>
              {t("hike.resharingDisabledNote")}
            </Text>
          )}
          {sharedHike.allowResharing && (
            <Button
              testID="shared-hike-share"
              style={s.button}
              mode="contained"
              icon="share"
              onPress={() => (reason === "banned" ? setShowBannedDialog(true) : setShowShareModal(true))}
            >
              {t("hike.reshare")}
            </Button>
          )}
          <Button
            testID="shared-hike-delete"
            style={s.removeButton}
            mode="text"
            icon="delete-outline"
            textColor={theme.colors.error}
            onPress={() => setShowDeleteDialog(true)}
          >
            {t("hike.removeShared")}
          </Button>
        </View>
      }
    >
      <AlertDialog
        visible={showDeleteDialog}
        onDismiss={() => setShowDeleteDialog(false)}
        title={t("hike.deleteTitle")}
        infoText={[t("hike.removeSharedConfirm")]}
        warning={t("hike.removeSharedNote")}
        icon="delete-outline"
        tone="danger"
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        onConfirm={() => deleteMutation.mutate(sharedHike)}
      />
      <AccountBannedDialog visible={showBannedDialog} onDismiss={() => setShowBannedDialog(false)} />
      <ImageViewer
        images={sharedHike.images ?? []}
        visible={viewerIndex !== null}
        initialIndex={viewerIndex ?? 0}
        onDismiss={() => setViewerIndex(null)}
        onReport={(image) => {
          setViewerIndex(null);
          if (reason === "banned") setShowBannedDialog(true);
          else setReportedImage(image);
        }}
      />
      {reportedImage && (
        <ReportContentForm
          visible
          contentType="HikeImage"
          contentIdentifier={reportedImage.identifier}
          invalidateQueryKey={[...sharedHikesQueryKey(user.data?.identifier)]}
          onDismiss={() => setReportedImage(null)}
        />
      )}
      <ReshareHikeModal
        visible={showShareModal}
        onDismiss={() => setShowShareModal(false)}
        onShare={(friendNickNames) =>
          reshareMutation.mutate({ hikeIdentifier: sharedHike.hikeIdentifier, reShareToNames: friendNickNames })
        }
        isPending={reshareMutation.isPending}
        excludeNickNames={[sharedHike.sharedByName, sharedHike.createdByName].filter((n): n is string => !!n)}
      />
    </HikeDetailLayout>
  );
}

const s = StyleSheet.create({
  actionColumn: {
    flex: 1,
    gap: 6,
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
  removeButton: {
    alignSelf: "center",
    borderRadius: BORDER_RADIUS,
  },
  resharingNote: {
    textAlign: "center",
  },
});
