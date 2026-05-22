import AreaCard from "@/components/area/area-card";
import { borasAreas } from "@/data/areas-data";
import { ScrollView } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function AreaListScreen() {
  const theme = useTheme();

  return (
    <ScrollView contentContainerStyle={{ padding: 10, gap: 15, backgroundColor: theme.colors.background }}>
      <Text style={{ fontWeight: 700, fontSize: 20 }}>Områden</Text>
      {borasAreas.map((area, index) => {
        return <AreaCard key={index} area={area} />;
      })}
    </ScrollView>
  );
}
