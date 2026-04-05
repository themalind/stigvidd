import { getAllHikesByUserId } from "@/api/hikes";
import { authStateAtom } from "@/atoms/auth-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import BackButton from "@/components/back-button";
import LoadingIndicator from "@/components/loading-indicator";
import HikeDetails from "@/components/trail/trail-creator/hike-details";
import { BORDER_RADIUS } from "@/constants/constants";
import { Hike } from "@/data/types";
import FormattedTime from "@/utils/format-time-from-ms";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Icon, Text, useTheme } from "react-native-paper";

export default function MyHikesScreen() {
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);
  const user = useAtomValue(stigviddUserAtom);
  const [visible, setVisible] = useState(false);
  const [hike, setSelectedhike] = useState<Hike | null>(null);

  const {
    data: hikes,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["hikes", user.data?.identifier],
    queryFn: () => getAllHikesByUserId(user.data!.identifier),
    enabled: !!authState.isAuthenticated && !!user?.data,
  });

  if (!authState.isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError && error) {
    return (
      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}
      >
        <BackButton />
        <Text style={{ color: theme.colors.error }}>{error.message}</Text>
      </View>
    );
  }

  if (hikes?.length === 0) {
    return (
      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}
      >
        <BackButton />
        <Text style={{ color: theme.colors.onBackground }}>No hikes saved</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <BackButton />
      <View style={{ flexDirection: "row", gap: 10, paddingTop: 10, paddingBottom: 10 }}>
        <Icon source="hiking" size={24} color={theme.colors.tertiary} />
        <Text style={{ fontSize: 17, fontWeight: 700 }}>Mina sparade promenader</Text>
      </View>
      <View style={[s.infoBox, { backgroundColor: theme.colors.outlineVariant }]}>
        <Text>Tryck på en promenad för att se mer information eller ta bort den.</Text>
      </View>
      <Divider bold={true} />
      {hike && (
        <HikeDetails
          visible={visible}
          hike={hike}
          onDismiss={() => {
            setVisible(false);
            setSelectedhike(null);
          }}
        />
      )}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {hikes?.map((hike, index) => (
          <Pressable
            style={{
              backgroundColor: theme.colors.surface,
              padding: 10,
              borderRadius: BORDER_RADIUS,
            }}
            key={index}
            onPress={() => {
              setSelectedhike(hike);
              setVisible(true);
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[s.iconCircle, { backgroundColor: theme.colors.secondaryContainer }]}>
                <Icon source="map-marker-distance" size={28} color={theme.colors.onSecondaryContainer} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>
                  {hike.name}
                </Text>
                <View style={s.info}>
                  <Text>{hike.hikeLength} km</Text>
                  <Text>{FormattedTime(hike.duration)}</Text>
                </View>
              </View>
              <Icon source="chevron-right" size={20} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    gap: 10,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontWeight: "bold",
  },
  info: {
    flexDirection: "row",
    gap: 12,
    marginTop: 2,
  },
  infoBox: {
    borderRadius: BORDER_RADIUS,
    padding: 12,
    gap: 6,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scrollContent: {
    gap: 10,
    borderRadius: BORDER_RADIUS,
  },
});
