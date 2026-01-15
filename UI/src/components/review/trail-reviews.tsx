import { showSuccessAtom } from "@/atoms/snackbar-atoms";
import { Review } from "@/data/types";
import { useSetAtom } from "jotai";
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
  const setReportMsg = useSetAtom(showSuccessAtom);
  console.log("Reviews:", reviews);
  reviews.forEach((r) => {
    console.log("Review images:", r.reviewImages);
  });
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
                <Rating review={r} starSize={13} />
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
                s.reportContainer,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <Text>{formatDate(r.createdAt)}</Text>
              <Pressable onPress={handlePress}>
                <List.Icon color={theme.colors.outline} icon="alert-circle" />
              </Pressable>
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
  reportContainer: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexDirection: "row",
    paddingBottom: 10,
    paddingTop: 15,
    paddingRight: 10,
  },
});
