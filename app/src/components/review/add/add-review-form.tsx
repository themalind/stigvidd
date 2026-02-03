import { createReview } from "@/api/review";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
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
  const theme = useTheme();
  const [showImageInfoModal, setShowImageInfoModal] = useState(false);
  const [showStarInfoModal, setShowStarInfoModal] = useState(false);
  const [showReviewInfoModal, setShowReviewInfoModal] = useState(false);
  const [height, setHeight] = useState(40);
  const [rating, setRating] = useState(1);
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const setError = useSetAtom(showErrorAtom);
  const setSuccess = useSetAtom(showSuccessAtom);
  const queryClient = useQueryClient();

  function handleReviewImages(data: string[]) {
    setReviewImages(data);
  }

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

  // Flytta ut till egen hook?
  const createReviewMutation = useMutation({
    mutationFn: async ({
      trailIdentifier,
      review,
      rating,
      imageUris,
    }: {
      trailIdentifier: string;
      review: string;
      rating: number;
      imageUris: string[];
    }) => {
      return await createReview({
        trailIdentifier,
        review,
        rating,
        imageUris,
      });
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({
          // Uppdatera medelbetyget i trail
          queryKey: ["trail", variables.trailIdentifier],
        });
        queryClient.invalidateQueries({
          // Uppdatera listan i recensionsfältet
          queryKey: ["reviews", variables.trailIdentifier],
        });
        setSuccess("Recensionen har lagts till");
        onSuccess();
      } else {
        console.error("Error creating review");
        setError("Kunde inte spara recensionen");
      }
    },
    onError: (error) => {
      console.error("Error creating review: ", error);
      setError("Kunde inte spara recensionen");
    },
  });

  const onImageInfoPress = () => {
    setShowImageInfoModal(true);
  };

  const onStarRatingInfoPress = () => {
    setShowStarInfoModal(true);
  };

  const onReviewInfoPress = () => {
    setShowReviewInfoModal(true);
  };

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
        <Text>Väl ett betyg *</Text>
        <MaterialCommunityIcons
          name="information-slab-circle-outline"
          size={24}
          color={theme.colors.onSurface}
          onPress={onStarRatingInfoPress}
        />
        <AlertDialog
          visible={showStarInfoModal}
          onDismiss={() => setShowStarInfoModal(false)}
          title="Sätt ett betyg"
          infoText="Hur nöjd är du med promenaden? ⭐️⭐️ Välj mellan 1 och 5 stjärnor."
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
        <Text>Lägg till bild (valfritt)</Text>
        <MaterialCommunityIcons
          name="information-slab-circle-outline"
          size={24}
          color={theme.colors.onSurface}
          onPress={onImageInfoPress}
        />
        <AlertDialog
          visible={showImageInfoModal}
          onDismiss={() => setShowImageInfoModal(false)}
          title="Lägg till bilder"
          infoText="Visa oss dina promenadäventyr! Lägg gärna till bilder från promenaden, men undvik bilder som kan vara stötande eller olämpliga. Max 3 bilder per promenad."
          backgroundColor={theme.colors.background}
          textColor={theme.colors.onBackground}
        />
      </View>
      <View style={s.rowGap}>
        <AddReviewImages reviewImageCallback={handleReviewImages} />
      </View>
      <Divider />
      <View style={s.gap}>
        <View style={s.rowGap}>
          <Text>Skriv en recension eller kommentar</Text>
          <MaterialCommunityIcons
            name="information-slab-circle-outline"
            size={24}
            color={theme.colors.onSurface}
            onPress={onReviewInfoPress}
          />
          <AlertDialog
            visible={showReviewInfoModal}
            onDismiss={() => setShowReviewInfoModal(false)}
            title="Skriv något"
            infoText="Berätta för oss om promenaden! Skriv en kommentar eller recension om dina upplevelser. Tänk på att hålla texten trevlig och respektfull."
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
              multiline={true}
              maxLength={500}
              onChangeText={onChange}
              value={value}
              label="Recension"
              onContentSizeChange={(event) => setHeight(event.nativeEvent.contentSize.height)}
              style={{ height: Math.max(40, height) }}
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
          onPress={handleSubmit(onSubmit, (errors) => {
            console.log("Validation failed:", errors);
          })}
          disabled={isSubmitting || createReviewMutation.isPending}
        >
          {createReviewMutation.isPending ? "Sparar..." : "Spara"}
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
    gap: 10,
  },
  gap: {
    gap: 20,
  },
});
