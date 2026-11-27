// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { showErrorAtom } from "@/atoms/snackbar-atoms";
import AlertDialog from "@/components/dialog/alert-dialog";
import CountedTextInput from "@/components/form/counted-text-input";
import InfoHeading from "@/components/layout/info-heading";
import { asTranslationKey } from "@/i18n";
import { BORDER_RADIUS, MAX_REVIEW_IMAGES, MAX_REVIEW_LENGTH } from "@/constants/constants";
import { Review } from "@/data/types";
import { useCreateReview } from "@/hooks/review/useCreateReview";
import { useDeleteReview } from "@/hooks/review/useDeleteReview";
import { useUpdateReview } from "@/hooks/review/useUpdateReview";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";
import StarRating from "react-native-star-rating-widget";
import { z } from "zod";
import AddReviewImages, { ReviewFormImage } from "./add-review-images";

interface ReviewFormProps {
  trailIdentifier: string;
  // keep-comment: given when editing; the form then starts from it and saves over it
  review?: Review;
  onSuccess: () => void;
}

const newReviewForm = z.object({
  trailReview: z.optional(z.string().max(MAX_REVIEW_LENGTH, "review.reviewTooLong")),
  rating: z.number().min(1, "review.ratingRequired").max(5, "review.ratingRequired"),
  trailIdentifier: z
    .string({ error: "trailIdentifier is required." })
    .pipe(z.guid({ error: "trailIdentifier must be of type uuid." })),
});

type FormFields = z.infer<typeof newReviewForm>;

function storedImages(review: Review | undefined): ReviewFormImage[] {
  return (review?.reviewImages ?? []).map((image) => ({
    kind: "stored",
    identifier: image.identifier,
    uri: image.imageUrl,
  }));
}

export default function AddReviewForm({ trailIdentifier, review, onSuccess }: ReviewFormProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [images, setImages] = useState(() => storedImages(review));
  const setError = useSetAtom(showErrorAtom);
  const createReviewMutation = useCreateReview(onSuccess);
  const updateReviewMutation = useUpdateReview(onSuccess);
  const deleteReviewMutation = useDeleteReview(onSuccess);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPending = createReviewMutation.isPending || updateReviewMutation.isPending || deleteReviewMutation.isPending;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({
    resolver: zodResolver(newReviewForm),
    // keep-comment: 0 is "no star yet"; the schema's min(1) makes a rating required
    defaultValues: {
      trailIdentifier: trailIdentifier,
      rating: review?.rating ?? 0,
      trailReview: review?.trailReview ?? undefined,
    },
  });

  const onSubmit: SubmitHandler<FormFields> = (data) => {
    if (!trailIdentifier) {
      setError("Error: No TrailIdentifier");
      return;
    }

    const newImageUris = images.flatMap((image) => (image.kind === "new" ? [image.uri] : []));

    if (review) {
      const keptIdentifiers = new Set(images.flatMap((image) => (image.kind === "stored" ? [image.identifier] : [])));

      updateReviewMutation.mutate({
        reviewIdentifier: review.identifier,
        review: data.trailReview ?? "",
        rating: data.rating,
        removedImageIdentifiers: (review.reviewImages ?? [])
          .map((image) => image.identifier)
          .filter((identifier) => !keptIdentifiers.has(identifier)),
        newImageUris,
      });
      return;
    }

    createReviewMutation.mutate({
      trailIdentifier: data.trailIdentifier,
      review: data.trailReview ?? "",
      rating: data.rating,
      imageUris: newImageUris,
    });
  };

  return (
    <View style={s.formContainer}>
      <Divider />
      <InfoHeading
        label={t("review.rating")}
        infoTitle={t("review.ratingTitle")}
        infoText={[t("review.ratingQuestion"), t("review.ratingInstruction")]}
      />
      <View>
        <Controller
          control={control}
          render={({ field: { onChange, value } }) => (
            <StarRating
              rating={value}
              // Library bug: step="full" doesn't clamp, so a drag past the last star yields 6+. keep-comment: workaround
              onChange={(rating) => onChange(Math.min(5, rating))}
              color={theme.colors.onSurface}
              starSize={25}
              step="full"
            />
          )}
          name="rating"
        />
        {errors.rating?.message && (
          <Text style={[s.error, { color: theme.colors.error }]}>{t(asTranslationKey(errors.rating.message))}</Text>
        )}
      </View>
      <Divider />
      <InfoHeading
        label={t("review.addImage")}
        infoTitle={t("review.addImageTitle")}
        infoText={[
          t("review.addImageInfo1"),
          t("review.addImageInfo2"),
          t("review.addImageInfo3", { max: MAX_REVIEW_IMAGES }),
        ]}
      />
      <View style={s.rowGap}>
        <AddReviewImages images={images} onChange={setImages} />
      </View>
      <Divider />
      <View style={s.gap}>
        <InfoHeading
          label={t("review.writeReview")}
          infoTitle={t("review.writeReviewTitle")}
          infoText={[t("review.writeReviewInfo1"), t("review.writeReviewInfo2")]}
        />
        <Controller
          control={control}
          render={({ field: { onChange, onBlur, value } }) => (
            <CountedTextInput
              testID="review-text"
              error={!!errors.trailReview}
              onBlur={onBlur}
              autoCapitalize="sentences"
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              onChangeText={onChange}
              value={value}
              maxLength={MAX_REVIEW_LENGTH}
              label={t("review.reviewLabel")}
              theme={{
                colors: {
                  primary: theme.colors.onSurface,
                },
              }}
            />
          )}
          name="trailReview"
        />
        {errors.trailReview?.message && (
          <Text style={[s.error, { color: theme.colors.error }]}>
            {t(asTranslationKey(errors.trailReview.message))}
          </Text>
        )}
      </View>
      <Divider />
      <View>
        <Button
          mode="contained"
          style={s.button}
          onPress={() => handleSubmit(onSubmit)()}
          disabled={isSubmitting || isPending}
        >
          {isPending ? t("common.saving") : t("common.save")}
        </Button>
        {review && (
          <Button
            testID="delete-own-review"
            mode="text"
            icon="delete-outline"
            textColor={theme.colors.error}
            style={s.deleteButton}
            onPress={() => setConfirmDelete(true)}
            disabled={isPending}
          >
            {t("review.deleteTitle")}
          </Button>
        )}
      </View>
      {review && (
        <AlertDialog
          testID="review-delete-dialog"
          visible={confirmDelete}
          onDismiss={() => setConfirmDelete(false)}
          title={t("review.deleteTitle")}
          infoText={[t("review.deleteConfirm")]}
          icon="delete-outline"
          tone="danger"
          irreversible
          confirmText={t("common.delete")}
          cancelText={t("common.cancel")}
          onConfirm={() => {
            deleteReviewMutation.mutate({ reviewIdentifier: review.identifier, trailIdentifier });
            setConfirmDelete(false);
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  formContainer: {
    padding: 10,
    gap: 20,
  },
  rowGap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gap: {
    gap: 20,
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
  deleteButton: {
    alignSelf: "center",
    marginTop: 10,
  },
  error: {
    fontWeight: "700",
  },
});
