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
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
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

  return (
    <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
      <View style={s.header}>
        <BackButton />
        <Icon source="hiking" size={24} color={theme.colors.tertiary} />
        <Text style={s.headerText}>Delade promenader</Text>
      </View>
      <View style={s.content}>
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
        {hikes?.length === 0 ? (
          <View style={[s.noHikesContainer, { backgroundColor: theme.colors.background }]}>
            <Text style={{ color: theme.colors.onBackground }}>Inga delade promenader här än</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
            {hikes?.map((hike, index) => (
              <Pressable
                style={[s.hikePressable, { backgroundColor: theme.colors.surface }]}
                key={index}
                onPress={() => {
                  setSelectedSharedHike(hike);
                  setVisible(true);
                }}
              >
                <View style={s.hikeInfo}>
                  <View style={[s.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Fontisto name="map" size={24} color={theme.colors.secondary} />
                  </View>
                  <View style={s.flex}>
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
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: Platform.select({ ios: 4, default: 10 }),
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 10,
  },
  noHikesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    fontSize: 17,
    fontWeight: "700",
  },
  hikePressable: {
    padding: 10,
    borderRadius: BORDER_RADIUS,
  },
  hikeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
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
