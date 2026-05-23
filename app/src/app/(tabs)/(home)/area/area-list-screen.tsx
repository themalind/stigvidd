import AreaCard from "@/components/area/area-card";
import BackButton from "@/components/back-button";
import { borasAreas } from "@/data/areas-data";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function AreaListScreen() {
  const theme = useTheme();

  return (
    <>
      <View style={[s.header, { backgroundColor: theme.colors.background }]}>
        <BackButton />
        <Text style={s.title}>Områden</Text>
      </View>
      <ScrollView contentContainerStyle={[s.scrollContent, { backgroundColor: theme.colors.background }]}>
        {borasAreas.map((area, index) => {
          return <AreaCard key={index} area={area} />;
        })}
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Platform.select({ ios: 4, default: 10 }),
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  title: {
    fontWeight: "700",
    fontSize: 20,
  },
  scrollContent: {
    padding: 10,
    gap: 15,
  },
});
