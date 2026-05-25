import { AppLanguage, changeLanguage } from "@/i18n";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { SegmentedButtons, Text, useTheme } from "react-native-paper";

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  return (
    <View style={s.container}>
      <Text style={[s.label, { color: theme.colors.onSurface }]}>{i18n.language === "sv" ? "Språk" : "Language"}</Text>
      <SegmentedButtons
        value={i18n.language}
        onValueChange={(value) => changeLanguage(value as AppLanguage)}
        buttons={[
          { value: "sv", label: "Svenska" },
          { value: "en", label: "English" },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
});
