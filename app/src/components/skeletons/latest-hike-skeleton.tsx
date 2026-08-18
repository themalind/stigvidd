import { CARD_HEIGHT } from "@/components/home/latest-hike-card";
import ShimmerBlock from "@/components/skeletons/shimmer-block";
import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

// Holds the latest-hike card's slot while the query runs. The heading is the real one —
// it is known before the data is, so only the card itself has to fill in.
export default function LatestHikeSkeleton() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: theme.colors.onBackground }]}>{t("home.latestHike")}</Text>
      <ShimmerBlock style={s.card} />
    </View>
  );
}

// Mirrors latest-hike-card's own section and card metrics.
const s = StyleSheet.create({
  section: {
    gap: 8,
    paddingHorizontal: SCREEN_PADDING,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
});
