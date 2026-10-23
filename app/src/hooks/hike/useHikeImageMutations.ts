// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { deleteHikeImage, uploadHikeImage } from "@/api/hikes";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { MAX_HIKE_IMAGES } from "@/constants/constants";
import { Hike, HikeImage } from "@/data/types";
import { myHikesQueryKey } from "@/hooks/hike/useMyHikes";
import { track } from "@/services/analytics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function useHikeImageMutations(hikeIdentifier: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAtomValue(stigviddUserAtom);
  const setErrorMsg = useSetAtom(showErrorAtom);
  const [uploadingCount, setUploadingCount] = useState(0);
  const listKey = myHikesQueryKey(user.data?.identifier);

  const patchImages = (update: (images: HikeImage[]) => HikeImage[]) =>
    queryClient.setQueryData<Hike[]>(listKey, (hikes) =>
      hikes?.map((h) => (h.identifier === hikeIdentifier ? { ...h, images: update(h.images ?? []) } : h)),
    );

  const uploadMutation = useMutation({
    // keep-comment: one at a time so each image lands in the cache as soon as it is stored
    mutationFn: async (uris: string[]) => {
      setUploadingCount(uris.length);
      let uploaded = 0;
      try {
        for (const uri of uris) {
          const image = await uploadHikeImage(hikeIdentifier, uri);
          patchImages((images) => [...images, image]);
          uploaded++;
          setUploadingCount((count) => count - 1);
        }
      } finally {
        setUploadingCount(0);
        track("hike.images_added", { requested: uris.length, uploaded });
      }
    },
    onError: (error) =>
      setErrorMsg(
        error instanceof ApiError && error.status === 409
          ? t("hike.imageLimit", { max: MAX_HIKE_IMAGES })
          : t("hike.imageUploadError"),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (imageIdentifier: string) => deleteHikeImage(hikeIdentifier, imageIdentifier),
    onSuccess: (_, imageIdentifier) => {
      patchImages((images) => images.filter((i) => i.identifier !== imageIdentifier));
      track("hike.image_removed", {});
    },
    onError: () => setErrorMsg(t("hike.imageDeleteError")),
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });

  return {
    upload: uploadMutation.mutate,
    uploadingCount,
    isUploading: uploadMutation.isPending,
    deleteImage: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
