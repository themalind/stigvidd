import AreaCard from "@/components/area/area-card";
import BackButton from "@/components/back-button";
import { borasAreas } from "@/data/areas-data";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function AreaListScreen() {
  const theme = useTheme();

  return (
    <ScrollView contentContainerStyle={[s.scrollContent, { backgroundColor: theme.colors.background }]}>
      <View style={[s.header, { backgroundColor: theme.colors.background }]}>
        <BackButton />
        <Text style={[s.title, { color: theme.colors.onBackground }]}>Områden</Text>
      </View>
      <View style={s.content}>
        {borasAreas.map((area, index) => {
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
    paddingLeft: Platform.select({ ios: 0, default: 10 }),
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
    gap: 8,
  },
  content: {
    paddingHorizontal: 10,
    gap: 15,
  },
});
