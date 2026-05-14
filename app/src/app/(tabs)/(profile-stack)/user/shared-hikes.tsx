import { getSharedHikes } from "@/api/shared-hikes";
import { authStateAtom } from "@/atoms/auth-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import BackButton from "@/components/back-button";
import ErrorView from "@/components/error-view";
import LoadingIndicator from "@/components/loading-indicator";
import SharedHikeDetails from "@/components/shared-hike/shared-hike-details";
import { BORDER_RADIUS } from "@/constants/constants";
import { SharedHike } from "@/data/types";
import FormattedTime from "@/utils/format-time-from-ms";
import { Fontisto } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Divider, Icon, Text, useTheme } from "react-native-paper";

export default function SharedHikesScreen() {
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);
  const user = useAtomValue(stigviddUserAtom);
  const [visible, setVisible] = useState(false);
  const [sharedHike, setSelectedSharedHike] = useState<SharedHike | null>(null);

  const {
    data: hikes,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["shared-hikes", user.data?.identifier],
    queryFn: () => getSharedHikes(),
    enabled: !!authState.isAuthenticated && !!user?.data,
  });

  if (!authState.isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <ErrorView error={error} />;
  }

  if (hikes?.length === 0) {
    return (
      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}
      >
        <BackButton />
        <Text style={{ color: theme.colors.onBackground }}>No hikes shared with you yet</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <BackButton />
      <View style={{ flexDirection: "row", gap: 10, paddingTop: 10, paddingBottom: 10, alignItems: "center" }}>
        <Icon source="hiking" size={24} color={theme.colors.tertiary} />
        <Text style={{ fontSize: 17, fontWeight: 700 }}>Delade promenader</Text>
      </View>
      <View style={[s.infoBox, { backgroundColor: theme.colors.outlineVariant }]}>
        <Text>Tryck på en promenad för att se mer information eller ta bort den.</Text>
      </View>
      <Divider bold={true} />
      {sharedHike && (
        <SharedHikeDetails
          visible={visible}
          sharedHike={sharedHike}
          onDismiss={() => {
            setVisible(false);
            setSelectedSharedHike(null);
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
              setSelectedSharedHike(hike);
              setVisible(true);
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[s.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
                <Fontisto name="map" size={24} color={theme.colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>
                  {hike.hikeName}
                </Text>
                <View style={s.info}>
                  <Text>{hike.hikeLength} km</Text>
                  <Text>{FormattedTime(hike.duration)}</Text>
                  <Text>Delad av: {hike.sharedByName}</Text>
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
    width: 42,
    height: 42,
    borderRadius: BORDER_RADIUS,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontWeight: "bold",
  },
  info: {
    flexDirection: "row",
    justifyContent: "space-between",
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
