import { BORDER_RADIUS } from "@/constants/constants";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface News {
  title: string;
  date: string;
  image: number;
}

const news: News[] = [
  {
    title: "Våren är här och det är dags att röra på sig! 🥾",
    date: "5 apr 2026",
    image: require("../assets/images/spring.jpg"),
  },
  {
    title: "Nu blir det enklare än någonsin att hitta rätt led i Borås! 🌲🥾",
    date: "18 feb 2026",
    image: require("../assets/images/happy.png"),
  },
  {
    title: "Snart i appen: achievements! 🎉",
    date: "28 jan 2026",
    image: require("../assets/images/winners-news.png"),
  },
  {
    title: "Picke vann igen! Stigvidds mest promenerade promenad 2025!",
    date: "14 jan 2026",
    image: require("../assets/images/picke.jpg"),
  },
  {
    title: "Snökaos! ❄️ Promenader du kan gå trots snön",
    date: "10 jan 2026",
    image: require("../assets/images/snow-news.jpg"),
  },
];

export default function MockNews() {
  const theme = useTheme();

  return (
    <View style={s.list}>
      {news.map((item, index) => (
        <Pressable
          key={item.date}
          style={({ pressed }) => [
            s.row,
            { borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth, borderColor: theme.colors.outlineVariant },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Image source={item.image} style={s.thumbnail} contentFit="cover" />
          <View style={s.textBlock}>
            <Text style={[s.title, { color: theme.colors.onSurface }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[s.date, { color: theme.colors.onSurfaceVariant }]}>{item.date}</Text>
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
