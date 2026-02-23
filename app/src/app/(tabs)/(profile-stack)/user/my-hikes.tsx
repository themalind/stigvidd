import { getAllHikesByUserId } from "@/api/hikes";
import { authStateAtom } from "@/atoms/auth-atoms";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import FormattedTime from "@/utils/format-time-from-ms";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useAtom, useAtomValue } from "jotai";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function MyHikesScreen() {
  const theme = useTheme();
  const [authState] = useAtom(authStateAtom);
  const user = useAtomValue(stigviddUserAtom);

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
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <Text style={{ color: theme.colors.onBackground }}>No hikes saved</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      <Text>hello</Text>

      {hikes?.map((hike, index) => {
        return (
          <View key={index} style={[s.hike, { backgroundColor: theme.colors.surface }]}>
            <View>
              <Text style={s.name}>{hike.name}</Text>
            </View>
            <View style={s.info}>
              <Text>Längd: {hike.hikeLength} km</Text>
              <Text>Tid: {FormattedTime(hike.duration)}</Text>
            </View>
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
    borderRadius: 10,
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
