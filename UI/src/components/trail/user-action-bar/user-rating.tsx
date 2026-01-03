import FontAwesome from "@expo/vector-icons/FontAwesome";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

export default function UserRating() {
  const theme = useTheme();
  return (
    <View style={s.container}>
      <TouchableOpacity style={s.touchable}>
        <FontAwesome
          name="thumbs-o-up"
          size={30}
          color={theme.colors.onPrimary}
        />
        <Text style={[s.text, { color: theme.colors.onPrimary }]}>
          Betygsätt
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "column",
  },
  touchable: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 12,
  },
});
