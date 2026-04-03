import { getAllHikesByUserId } from "@/api/hikes";
import { authStateAtom } from "@/atoms/auth-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import BackButton from "@/components/back-button";
import HikeDetails from "@/components/trail/trail-creator/hike-details";
import { BORDER_RADIUS } from "@/constants/constants";
import { Hike } from "@/data/types";
import FormattedTime from "@/utils/format-time-from-ms";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useAtom, useAtomValue } from "jotai";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function MyHikesScreen() {
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);
  const user = useAtomValue(stigviddUserAtom);
  const [visible, setVisible] = useState(false);
  const [hike, setSelectedhike] = useState<Hike | null>(null);

  const query = useQuery({
    queryKey: ["hikes", user.data?.identifier],
    queryFn: () => getAllHikesByUserId(user.data!.identifier),
    enabled: !!authState.isAuthenticated && !!user?.data,
  });

  if (!authState.isAuthenticated) {
    return <Redirect href="/(tabs)/(auth)/login" />;
  }

  const hikes = query.data;

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
      <Text>hello</Text>

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

      {hikes?.map((hike, index) => {
        return (
          <View key={index} style={[s.hike, { backgroundColor: theme.colors.surface }]}>
            <Pressable
              onPress={() => {
                setSelectedhike(hike);
                setVisible(true);
              }}
            >
              <View>
                <Text style={s.name}>{hike.name}</Text>
              </View>
              <View style={s.info}>
                <Text>Längd: {hike.hikeLength} km</Text>
                <Text>Tid: {FormattedTime(hike.duration)}</Text>
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    gap: 10,
  },
  hike: {
    borderRadius: BORDER_RADIUS,
    padding: 10,
    gap: 4,
  },
  name: {
    fontWeight: "bold",
  },
  info: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
