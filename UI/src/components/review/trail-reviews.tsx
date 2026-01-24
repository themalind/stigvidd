import { deleteReview } from "@/api/review";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { Review } from "@/data/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtom, useSetAtom } from "jotai";
import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Divider, List, Text, useTheme } from "react-native-paper";
import { Rating } from "../rating";
import ReviewImages from "./review-images";

interface ReviewProps {
  reviews: Review[];
}

const formatDate = (dateString: string): string => {
  return dateString.split("T")[0];
};

export default function TrailReviews({ reviews }: ReviewProps) {
  const theme = useTheme();
  const [{ data: user }] = useAtom(stigviddUserAtom);
  const setReportMsg = useSetAtom(showSuccessAtom);
  const setError = useSetAtom(showErrorAtom);
  const queryClient = useQueryClient();

  // Flytta ut till egen hook?
  const deleteMutation = useMutation({
    mutationFn: ({
      reviewIdentifier,
    }: {
      reviewIdentifier: string;
      trailIdentifier: string;
    }) => deleteReview(reviewIdentifier),
    onSuccess: (result, { trailIdentifier }) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["trail", trailIdentifier] });
        setReportMsg("Recensionen har tagits bort");
      } else {
        setError("Kunde inte ta bort recensionen.");
      }
    },
  });

  const handleDelete = async (
    reviewIdentifier: string,
    trailIdentifier: string,
  ) => {
    deleteMutation.mutate({ reviewIdentifier, trailIdentifier });
  };

  const handlePress = () => {
    // Hej admin här kommer en olämplig review
    setReportMsg("For Gnomeregan!");
  };

  return (
    <List.Section style={{ borderRadius: 20 }}>
      {reviews.map((r) => (
        <Fragment key={r.identifier}>
          <List.Accordion
            style={{
              backgroundColor: theme.colors.surface,
            }}
            contentStyle={{ paddingLeft: 0 }}
            titleStyle={[s.title, { backgroundColor: theme.colors.surface }]}
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
            title={r.userName}
            description={
              <View
                style={{
                  transform: [{ translateX: -5 }],
                }}
              >
                <Rating
                  review={r}
                  starSize={13}
                  starColor={theme.colors.secondary}
                />
              </View>
            }
          >
            <View
              style={[
                s.reviewTextContainer,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <View style={{ gap: 20 }}>
                {r.trailReview && <Text>{r.trailReview}</Text>}
              </View>
              {r.reviewImages && <ReviewImages reviewImages={r.reviewImages} />}
            </View>
            <View
              style={[
                s.bottomContainer,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <Text>{formatDate(r.createdAt)}</Text>
              <View style={s.actionContainer}>
                <Pressable onPress={handlePress}>
                  <List.Icon color={theme.colors.outline} icon="alert-circle" />
                </Pressable>
                {user?.identifier === r.userIdentifier && (
                  <Pressable
                    disabled={deleteMutation.isPending}
                    onPress={() =>
                      handleDelete(r.identifier, r.trailIdentifier)
                    }
                  >
                    <List.Icon
                      color={
                        deleteMutation.isPending
                          ? theme.colors.surfaceDisabled
                          : theme.colors.outline
                      }
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
