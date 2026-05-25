import { BORDER_RADIUS } from "@/constants/constants";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

const newsImages = [
  require("../assets/images/spring.jpg"),
  require("../assets/images/happy.png"),
  require("../assets/images/winners-news.png"),
  require("../assets/images/picke.jpg"),
  require("../assets/images/snow-news.jpg"),
];

export default function MockNews() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={s.list}>
      {newsImages.map((image, index) => (
        <Pressable
          key={index}
          style={({ pressed }) => [
            s.row,
            { borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth, borderColor: theme.colors.outlineVariant },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Image source={image} style={s.thumbnail} contentFit="cover" />
          <View style={s.textBlock}>
            <Text style={[s.title, { color: theme.colors.onSurface }]} numberOfLines={2}>
              {t(`news.items.${index}.title`)}
            </Text>
            <Text style={[s.date, { color: theme.colors.onSurfaceVariant }]}>{t(`news.items.${index}.date`)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  list: {
    gap: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  date: {
    fontSize: 12,
  },
});
