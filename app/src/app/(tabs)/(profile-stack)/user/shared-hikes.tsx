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
import { useTranslation } from "react-i18next";

export default function SharedHikesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <BackButton />
          <Icon source="hiking" size={24} color={theme.colors.tertiary} />
          <Text style={s.headerText}>{t("hike.sharedHikesTitle")}</Text>
        </View>
        <View style={s.content}>
          <View style={[s.infoBox, { backgroundColor: theme.colors.outlineVariant }]}>
            <Text>{t("hike.pressForInfo")}</Text>
          </View>
          <Divider bold={true} />
          {hikes?.length === 0 ? (
            <Text style={{ color: theme.colors.onBackground, textAlign: "center", paddingVertical: 20 }}>
              {t("hike.noShared")}
            </Text>
          ) : (
            hikes?.map((hike, index) => (
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
                      <Text>{t("hike.sharedByLabel", { name: hike.sharedByName })}</Text>
                    </View>
                  </View>
                  <Icon source="chevron-right" size={20} />
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
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
    paddingLeft: Platform.select({ ios: 0, default: 10 }),
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
    paddingTop: 8,
    paddingBottom: 20,
    gap: 16,
  },
  content: {
    paddingHorizontal: 10,
    gap: 10,
  },
});
