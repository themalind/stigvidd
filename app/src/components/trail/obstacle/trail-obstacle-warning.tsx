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
    <View style={[s.container, { backgroundColor: theme.colors.background, borderColor: theme.colors.error }]}>
      <Pressable hitSlop={12} onPress={onPress}>
        <View style={s.row}>
          <View style={s.rowGap}>
            <MaterialIcons name="warning-amber" size={18} color={theme.colors.error} />
            <Text style={s.bold}>Hinder rapporterade längs promenaden!</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={theme.colors.onBackground} />
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: BORDER_RADIUS,
    gap: 5,
    padding: 5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowGap: {
    flexDirection: "row",
    gap: 5,
  },
  bold: {
    fontWeight: "700",
  },
});
