import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function UserShare() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={s.container}>
      <Pressable style={({ pressed }) => [s.touchable, pressed && { opacity: 0.7 }]}>
        <MaterialIcons name="share" size={30} color={theme.colors.onSurface} />
        <Text style={[s.text, { color: theme.colors.onSurface }]}>{t("userActions.share")}</Text>
      </Pressable>
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
