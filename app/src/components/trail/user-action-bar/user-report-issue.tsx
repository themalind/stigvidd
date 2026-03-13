import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export default function UserReportIssue() {
  const theme = useTheme();
  return (
    <View>
      <Pressable style={s.pressable}>
        <MaterialIcons name="warning-amber" size={30} color={theme.colors.onSurface} />
        <Text style={[s.text, { color: theme.colors.onSurface }]}>Rapportera</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 12,
  },
});
