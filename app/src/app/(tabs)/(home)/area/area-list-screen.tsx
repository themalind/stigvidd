import { getAreas } from "@/api/areas";
import AreaCard from "@/components/area/area-card";
import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import LoadingIndicator from "@/components/loading-indicator";

import { CITY_AREAS_STALE_TIME } from "@/constants/cache";
import { SCREEN_PADDING } from "@/constants/constants";
import { useQuery } from "@tanstack/react-query";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

export default function AreaListScreen() {
  const theme = useTheme();

  const {
    data: areas,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["cityAreas"],
    queryFn: () => getAreas(),
    staleTime: CITY_AREAS_STALE_TIME,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <ErrorView error={error} onRetry={refetch} />;
  }

  return (
    <ScrollView contentContainerStyle={[s.scrollContent, { backgroundColor: theme.colors.background }]}>
      <View style={[s.header, { backgroundColor: theme.colors.background }]}>
        <BackButton />
      </View>
      <View style={s.content}>
        {areas?.map((area, index) => {
          return <AreaCard key={index} area={area} />;
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Platform.select({ ios: 0, default: SCREEN_PADDING }),
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
    gap: 8,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 16,
  },
});
