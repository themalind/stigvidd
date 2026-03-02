import { showSuccessAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { BORDER_RADIUS } from "@/constants/constants";
import { Review } from "@/data/types";
import { useDeleteReview } from "@/hooks/review/useDeleteReview";
import { useAtom, useSetAtom } from "jotai";
import { Fragment } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Divider, List, Text, useTheme } from "react-native-paper";
import { Rating } from "../rating";
import ReviewImageGrid from "./review-image-grid ";

interface ReviewProps {
  reviews: Review[];
}

const formatDate = (dateString: string): string => {
  return dateString.split("T")[0];
};

export default function ReviewSection({ reviews }: ReviewProps) {
  const theme = useTheme();
  const [{ data: user }] = useAtom(stigviddUserAtom);
  const setSuccessMessage = useSetAtom(showSuccessAtom);
  const deleteMutation = useDeleteReview();

  const handleDelete = async (reviewIdentifier: string, trailIdentifier: string) => {
    // Byt till nåt snyggare typ alertdialogen
    Alert.alert("Ta bort recension", "Är du säker på att du vill ta bort din recension?", [
      {
        text: "Avbryt",
        style: "cancel",
      },
      {
        text: "Ta bort",
        style: "destructive",
        onPress: () => {
          deleteMutation.mutate({ reviewIdentifier, trailIdentifier });
        },
      },
    ]);
  };

  const handleReportReview = () => {
    // Hej admin här kommer en olämplig review
    setSuccessMessage("For Gnomeregan!");
  };

  return (
    <List.Section style={s.listSection}>
      {reviews.map((review) => (
        <Fragment key={review.identifier}>
          <List.Accordion
            style={{
              backgroundColor: theme.colors.surface,
            }}
            contentStyle={{ paddingLeft: 0 }}
            titleStyle={[s.title, { backgroundColor: theme.colors.surface, color: theme.colors.onSurface }]}
            right={(props) => (
              <List.Icon
                style={{
                  transform: [{ translateY: -10 }, { translateX: 15 }],
                  alignItems: "center",
                }}
                {...props}
                icon={props.isExpanded ? "chevron-up" : "chevron-down"}
              />
            )}
            title={review.userName}
            description={
              <View
                style={{
                  transform: [{ translateX: -5 }],
                }}
              >
                <Rating review={review} starSize={13} starColor={theme.colors.secondary} />
              </View>
            }
          >
            <View style={[s.reviewTextContainer, { backgroundColor: theme.colors.surface }]}>
              <View style={{ gap: 20 }}>{review.trailReview && <Text>{review.trailReview}</Text>}</View>
              {review.reviewImages && <ReviewImageGrid reviewImages={review.reviewImages} />}
            </View>
            <View style={[s.bottomContainer, { backgroundColor: theme.colors.surface }]}>
              <Text>{formatDate(review.createdAt)}</Text>
              <View style={s.actionContainer}>
                {user?.identifier !== review.userIdentifier && (
                  <Pressable onPress={handleReportReview}>
                    <List.Icon color={theme.colors.outline} icon="alert-circle" />
                  </Pressable>
                )}
                {user?.identifier === review.userIdentifier && (
                  <Pressable
                    disabled={deleteMutation.isPending}
                    onPress={() => handleDelete(review.identifier, review.trailIdentifier)}
                  >
                    <List.Icon
                      color={deleteMutation.isPending ? theme.colors.surfaceDisabled : theme.colors.outline}
                      icon="trash-can-outline"
                    />
                  </Pressable>
                )}
              </View>
            </View>
          </List.Accordion>
          <Divider />
        </Fragment>
      ))}
    </List.Section>
  );
}

const s = StyleSheet.create({
  listSection: {
    borderRadius: BORDER_RADIUS,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontWeight: 700,
    paddingBottom: 10,
    alignItems: "center",
  },
  reviewTextContainer: {
    alignItems: "flex-start",
  },
  actionContainer: {
    flexDirection: "row",
    gap: 40,
  },
  bottomContainer: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexDirection: "row",
    paddingBottom: 10,
    paddingTop: 15,
    paddingRight: 10,
  },
});
