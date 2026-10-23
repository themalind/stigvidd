// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { deleteHike, hikeRouteQueryKey, shareHike, updateHike } from "@/api/hikes";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import AlertDialog from "@/components/alert-dialog";
import AccountBannedDialog from "@/components/auth/account-banned-dialog";
import { useAuth } from "@/components/auth/auth-provider";
import HikeDetailLayout, { HikeDetailFallback } from "@/components/hike/hike-detail-layout";
import HikeImageSection from "@/components/hike/hike-image-section";
import ImageViewer from "@/components/review/image-viewer";
import LoadingIndicator from "@/components/loading-indicator";
import ShareHikeModal, { ShareHikeFormFields } from "@/components/shared-hike/share-hike-modal";
import EditHikeModal, { EditHikeFormFields } from "@/components/hike/edit-hike-modal";
import { BORDER_RADIUS, MAX_HIKE_IMAGES, MAX_PENDING_SUBMISSIONS } from "@/constants/constants";
import PublishHikeCard from "@/components/hike/publish-hike-card";
import PublishHikeModal from "@/components/hike/publish-hike-modal";
import { Hike, HikeSubmission, ShareHikeRequest, UpdateHikeRequest } from "@/data/types";
import { useHikeImageMutations } from "@/hooks/hike/useHikeImageMutations";
import { useMyHikeSubmissions } from "@/hooks/hike/useMyHikeSubmissions";
import { myHikesQueryKey, useMyHikes } from "@/hooks/hike/useMyHikes";
import { useCanWrite } from "@/hooks/useCanWrite";
import { track } from "@/services/analytics";
import { formatDate } from "@/utils/format-date";
import { guardedNavigate } from "@/utils/navigation";
import { pickImages } from "@/utils/pick-images";
import { ShareFailure, shareFailure } from "@/utils/share-failure";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { Button, Icon, useTheme } from "react-native-paper";

// keep-comment: each tab stack passes its own follow route, so back from the map returns to this screen
export type HikeFollowRoute =
  | "/(tabs)/(home)/hike-follow/[identifier]"
  | "/(tabs)/(profile-stack)/hike-follow/[identifier]";

const trackShared = (outcome: "success" | ShareFailure, request: ShareHikeRequest) =>
  track("hike.shared", {
    kind: "share",
    outcome,
    recipientCount: request.sharedWithNames.length,
    allowResharing: request.allowResharing,
  });

export default function HikeDetailsScreen({ hikeFollowRoute }: { hikeFollowRoute: HikeFollowRoute }) {
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBannedDialog, setShowBannedDialog] = useState(false);
  const [deletedHike, setDeletedHike] = useState<Hike | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const hikeIdentifier: string = Array.isArray(identifier) ? identifier[0] : identifier;
  const listKey = myHikesQueryKey(user.data?.identifier);
  const hikeImages = useHikeImageMutations(hikeIdentifier);
  const { data: hasPendingSubmission = false } = useMyHikeSubmissions(
    useCallback(
      (submissions: HikeSubmission[]) =>
        submissions.some((s) => s.sourceHikeIdentifier === hikeIdentifier && s.status === "Pending"),
      [hikeIdentifier],
    ),
  );
  const { data: published = null } = useMyHikeSubmissions(
    useCallback(
      (submissions: HikeSubmission[]) => {
        const approved = submissions.find(
          (s) => s.sourceHikeIdentifier === hikeIdentifier && s.status === "Approved" && s.publishedTrailIdentifier,
        );
        return approved ? { at: approved.decidedAt ?? null } : null;
      },
      [hikeIdentifier],
    ),
  );
  const { data: atPendingLimit = false } = useMyHikeSubmissions(
    useCallback(
      (submissions: HikeSubmission[]) =>
        submissions.filter((s) => s.status === "Pending").length >= MAX_PENDING_SUBMISSIONS,
      [],
    ),
  );
  const { data: hasSubmission = false } = useMyHikeSubmissions(
    useCallback(
      (submissions: HikeSubmission[]) =>
        submissions.some((s) => s.sourceHikeIdentifier === hikeIdentifier && s.status !== "Rejected"),
      [hikeIdentifier],
    ),
  );

  const {
    data: found,
    isPending,
    isError,
    error,
    refetch,
  } = useMyHikes(useCallback((hikes: Hike[]) => hikes.find((h) => h.identifier === hikeIdentifier), [hikeIdentifier]));
  // keep-comment: the list drops a deleted hike before the pop animation ends, so keep drawing it until then
  const hike = found ?? deletedHike;

  const updateHikeMutation = useMutation({
    mutationFn: (request: UpdateHikeRequest) => updateHike(request),
    onSuccess: (updated) => {
      queryClient.setQueryData<Hike[]>(listKey, (hikes) =>
        hikes?.map((h) => (h.identifier === updated.identifier ? { ...h, ...updated } : h)),
      );
      queryClient.invalidateQueries({ queryKey: listKey });
    },
    onError: () => setErrorMsg(t("hike.updateError")),
  });

  const deleteMutation = useMutation({
    mutationFn: (toDelete: Hike) => deleteHike(toDelete.identifier),
    onSuccess: (_, deleted) => {
      setDeletedHike(deleted);
      setSuccessMsg(t("hike.deleted"));
      router.back();
      queryClient.invalidateQueries({ queryKey: listKey });
    },
    onError: () => setErrorMsg(t("hike.genericError")),
  });

  const shareMutation = useMutation({
    mutationFn: (request: ShareHikeRequest) => shareHike(request),
    onSuccess: (_, request) => {
      setShowShareModal(false);
      setSuccessMsg(t("hike.shared"));
      trackShared("success", request);
    },
    onError: (error, request) => {
      setShowShareModal(false);
      const failure = shareFailure(error);
      if (failure === "recipient_unavailable") {
        queryClient.invalidateQueries({ queryKey: ["friends"] });
        setErrorMsg(t("hike.recipientUnavailable"));
      } else {
        setErrorMsg(t("hike.genericError"));
      }
      trackShared(failure, request);
    },
  });

  if (!hike) {
    if (!isAuthenticated) return <HikeDetailFallback error={new ApiError("Not signed in", 401)} />;
    if (isError) return <HikeDetailFallback error={error} onRetry={refetch} />;
    if (isPending) return <LoadingIndicator />;
    return <HikeDetailFallback error={new ApiError("Hike not found", 404)} />;
  }

  const unlessBanned = (open: () => void) => () => (reason === "banned" ? setShowBannedDialog(true) : open());

  const openFollowMap = () => {
    // keep-comment: the follow screen reads the route from this key, so it paints without a second request
    queryClient.setQueryData(hikeRouteQueryKey(hike.identifier), hike.coordinates ?? "");
    guardedNavigate(() =>
      router.navigate({ pathname: hikeFollowRoute, params: { identifier: hike.identifier, name: hike.name } }),
    );
  };

  const images = hike.images ?? [];

  const addImages = async () => {
    const limit = MAX_HIKE_IMAGES - images.length;
    if (limit <= 0) return;
    try {
      const uris = await pickImages({ limit });
      if (uris && uris.length > 0) hikeImages.upload(uris);
    } catch {
      setErrorMsg(t("hike.imageUploadError"));
    }
  };

  const handleEdit = (data: EditHikeFormFields) => {
    updateHikeMutation.mutate(
      {
        hikeIdentifier: hike.identifier,
        name: data.name,
        gettingThere: data.gettingThere || null,
        parkingInfo: data.parkingInfo || null,
        description: data.description || null,
      },
      { onSuccess: () => setShowEditModal(false) },
    );
  };

  const handleShare = async (friendNickNames: string[], formData: ShareHikeFormFields) => {
    try {
      await updateHikeMutation.mutateAsync({
        hikeIdentifier: hike.identifier,
        parkingInfo: formData.parkingInfo || null,
        gettingThere: formData.gettingThere || null,
        description: formData.description || null,
      });
    } catch {
      return;
    }
    shareMutation.mutate({
      hikeIdentifier: hike.identifier,
      sharedWithNames: friendNickNames,
      allowResharing: formData.allowResharing || false,
    });
  };

  return (
    <HikeDetailLayout
      title={hike.name}
      headerAction={
        <Pressable
          testID="hike-edit"
          hitSlop={12}
          onPress={unlessBanned(() => setShowEditModal(true))}
          accessibilityRole="button"
          accessibilityLabel={t("hike.edit")}
          style={s.headerAction}
        >
          <Icon size={22} source="pencil" color={theme.colors.onBackground} />
        </Pressable>
      }
      idPrefix="hike-details"
      hikeIdentifier={hike.identifier}
      coordinates={hike.coordinates}
      onOpenMap={openFollowMap}
      hikeLength={hike.hikeLength}
      duration={hike.duration}
      facts={[{ label: t("hike.created"), value: formatDate(hike.createdAt) }]}
      info={hike}
      media={
        <HikeImageSection
          images={images}
          onOpen={setViewerIndex}
          edit={{ max: MAX_HIKE_IMAGES, uploadingCount: hikeImages.uploadingCount, onAdd: unlessBanned(addImages) }}
        />
      }
      beforeActions={
        <PublishHikeCard
          isPending={hasPendingSubmission}
          published={published}
          atPendingLimit={atPendingLimit}
          onPublish={unlessBanned(() => setShowPublishModal(true))}
        />
      }
      actions={
        <>
          <Button
            testID="hike-share"
            style={s.button}
            mode="contained"
            icon="share"
            onPress={unlessBanned(() => setShowShareModal(true))}
          >
            {t("hike.share")}
          </Button>
          <Button
            testID="hike-delete"
            style={s.button}
            mode="outlined"
            icon="delete"
            onPress={() => setShowDeleteDialog(true)}
          >
            {t("hike.delete")}
          </Button>
        </>
      }
    >
      <AlertDialog
        visible={showDeleteDialog}
        onDismiss={() => setShowDeleteDialog(false)}
        title={t("hike.deleteTitle")}
        infoText={[
          t("hike.deleteConfirm"),
          t("hike.deleteSharedNote"),
          ...(hasSubmission ? [t("hike.deleteSubmissionNote")] : []),
        ]}
        textColor={theme.colors.onSurface}
        confirmText={t("hike.delete")}
        cancelText={t("common.cancel")}
        onConfirm={() => deleteMutation.mutate(hike)}
        backgroundColor={theme.colors.surface}
      />
      <AccountBannedDialog visible={showBannedDialog} onDismiss={() => setShowBannedDialog(false)} />
      <ImageViewer
        images={images}
        visible={viewerIndex !== null}
        initialIndex={viewerIndex ?? 0}
        onDismiss={() => setViewerIndex(null)}
        onDelete={(image) => hikeImages.deleteImage(image.identifier)}
        deleteNotes={hasPendingSubmission ? [t("hike.deleteImageSubmissionNote")] : []}
      />
      <ShareHikeModal
        visible={showShareModal}
        onDismiss={() => setShowShareModal(false)}
        defaultValues={{
          gettingThere: hike.gettingThere ?? undefined,
          parkingInfo: hike.parkingInfo ?? undefined,
          description: hike.description ?? undefined,
        }}
        onShare={handleShare}
        isPending={shareMutation.isPending || updateHikeMutation.isPending}
      />
      {showPublishModal && (
        <PublishHikeModal
          hike={hike}
          nickName={user.data?.nickName ?? ""}
          onDismiss={() => setShowPublishModal(false)}
        />
      )}
      {showEditModal && (
        <EditHikeModal
          hike={hike}
          onDismiss={() => setShowEditModal(false)}
          onSave={handleEdit}
          isPending={updateHikeMutation.isPending}
        />
      )}
    </HikeDetailLayout>
  );
}

const s = StyleSheet.create({
  headerAction: {
    padding: 6,
  },
  button: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
  },
});
