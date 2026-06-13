import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function UserShare() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={s.container}>
      <TouchableOpacity style={s.touchable}>
        <MaterialIcons name="share" size={30} color={theme.colors.onSurface} />
        <Text style={[s.text, { color: theme.colors.onSurface }]}>{t("userActions.share")}</Text>
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
