import { BORDER_RADIUS } from "@/constants/constants";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  onPress: () => void;
}

export default function TrailObstacleWarning({ onPress }: Props) {
  const theme = useTheme();
  return (
    <View style={[s.container, { backgroundColor: theme.colors.outlineVariant, borderColor: theme.colors.error }]}>
      <Pressable onPress={onPress}>
        <Text style={{ fontWeight: 700 }}>Hinder rapporterade på den här promenaden!</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 5 }}>
            <MaterialIcons name="warning-amber" size={24} color={theme.colors.error} />
            <Text>Tryck här för att läsa mer</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="black" />
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: BORDER_RADIUS,
    flex: 1,
    gap: 5,
    padding: 5,
  },
});
