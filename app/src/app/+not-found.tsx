import { router, Stack } from "expo-router";
import { useTheme, Button } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export default function NotFoundScreen() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t("notFound.title") }} />
      <View style={[s.container, { backgroundColor: theme.colors.background }]}>
        <MaterialIcons name="search-off" size={56} color={theme.colors.error} style={s.icon} />
        <Text style={[s.title, { color: theme.colors.onBackground }]}>{t("notFound.title")}</Text>
        <Text style={[s.message, { color: theme.colors.onSurfaceVariant }]}>{t("error.404.message")}</Text>
        <Button mode="outlined" onPress={() => router.replace("/")} style={s.button}>
          {t("notFound.goHome")}
        </Button>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  icon: {
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    marginTop: 16,
  },
});
