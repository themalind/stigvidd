import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { BORDER_RADIUS } from "@/constants/constants";
import { useCreateReview } from "@/hooks/review/useCreateReview";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, Divider, Text, TextInput, useTheme } from "react-native-paper";
import StarRating from "react-native-star-rating-widget";
import { z } from "zod";
import AlertDialog from "../../alert-dialog";
import AddReviewImages from "./add-review-images";

interface ReviewFormProps {
  trailIdentifier: string;
  onSuccess: () => void;
}

const newReviewForm = z.object({
  trailReview: z.optional(z.string().max(500, "Review is too long. Max char 500.")),
  rating: z.number().min(1).max(5),
  trailIdentifier: z
    .string({ required_error: "trailIdentifier is required." })
    .uuid({ message: "trailIdentifier must be of type uuid." }),
});

type FormFields = z.infer<typeof newReviewForm>;

export default function AddReviewForm({ trailIdentifier, onSuccess }: ReviewFormProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [showImageInfoModal, setShowImageInfoModal] = useState(false);
  const [showStarInfoModal, setShowStarInfoModal] = useState(false);
  const [showReviewInfoModal, setShowReviewInfoModal] = useState(false);
  const [rating, setRating] = useState(1);
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const setError = useSetAtom(showErrorAtom);
  const createReviewMutation = useCreateReview(onSuccess);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormFields>({
    resolver: zodResolver(newReviewForm),
    defaultValues: {
      trailIdentifier: trailIdentifier,
    },
  });

  const onSubmit: SubmitHandler<FormFields> = async (data) => {
    if (!trailIdentifier) {
      setError("Error: No TrailIdentifier");
      return;
    }

    createReviewMutation.mutate({
      trailIdentifier: data.trailIdentifier,
      review: data.trailReview ?? "",
      rating: rating,
      imageUris: reviewImages,
    });
  };

  return (
    <View style={s.formContainer}>
      <Divider />
      <View style={s.rowGap}>
        <Text>{t("review.rating")}</Text>
        <MaterialCommunityIcons
          name="information-slab-circle-outline"
          size={24}
          color={theme.colors.onSurface}
          onPress={() => setShowStarInfoModal(true)}
        />
        <AlertDialog
          visible={showStarInfoModal}
          onDismiss={() => setShowStarInfoModal(false)}
          title={t("review.ratingTitle")}
          infoText={[t("review.ratingQuestion"), t("review.ratingInstruction")]}
          backgroundColor={theme.colors.background}
          textColor={theme.colors.onBackground}
        />
      </View>
      <View>
        <Controller
          control={control}
          render={({ field: { onChange, value } }) => (
            <StarRating
              rating={value}
              onChange={(newRating) => {
                setRating(newRating);
                onChange(newRating);
              }}
              color={theme.colors.onSurface}
              starSize={25}
            />
          )}
          name="rating"
          defaultValue={1}
        />
        {errors.rating && <Text>{errors.rating.message}</Text>}
      </View>
      <Divider />
      <View style={s.rowGap}>
        <Text>{t("review.addImage")}</Text>
        <MaterialCommunityIcons
          name="information-slab-circle-outline"
          size={24}
          color={theme.colors.onSurface}
          onPress={() => setShowImageInfoModal(true)}
        />
        <AlertDialog
          visible={showImageInfoModal}
          onDismiss={() => setShowImageInfoModal(false)}
          title={t("review.addImageTitle")}
          infoText={[t("review.addImageInfo1"), t("review.addImageInfo2"), t("review.addImageInfo3")]}
          backgroundColor={theme.colors.background}
          textColor={theme.colors.onBackground}
        />
      </View>
      <View style={s.rowGap}>
        <AddReviewImages setReviewImages={setReviewImages} />
      </View>
      <Divider />
      <View style={s.gap}>
        <View style={s.rowGap}>
          <Text>{t("review.writeReview")}</Text>
          <MaterialCommunityIcons
            name="information-slab-circle-outline"
            size={24}
            color={theme.colors.onSurface}
            onPress={() => setShowReviewInfoModal(true)}
          />
          <AlertDialog
            visible={showReviewInfoModal}
            onDismiss={() => setShowReviewInfoModal(false)}
            title={t("review.writeReviewTitle")}
            infoText={[t("review.writeReviewInfo1"), t("review.writeReviewInfo2")]}
            backgroundColor={theme.colors.background}
            textColor={theme.colors.onBackground}
          />
        </View>
        <Controller
          control={control}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              error={!!errors.trailReview}
              onBlur={onBlur}
              autoCapitalize="sentences"
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              onChangeText={onChange}
              value={value}
              maxLength={500}
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
        {errors.trailReview && <Text>{errors.trailReview.message}</Text>}
      </View>
      <Divider />
      <View>
        <Button
          mode="contained"
          style={s.button}
          onPress={handleSubmit(onSubmit, (errors) => {
            console.log("Validation failed:", errors);
          })}
          disabled={isSubmitting || createReviewMutation.isPending}
        >
          {createReviewMutation.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </View>
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
});
