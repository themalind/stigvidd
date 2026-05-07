import { BORDER_RADIUS } from "@/constants/constants";
import { useState } from "react";
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";

interface News {
  title: string;
  date: string;
  text: string;
  image: number;
}

const news: News[] = [
  {
    title: "Våren är här och det är dags att röra på sig! 🥾",
    date: "2026-04-05",
    text: "I appen finns flera färdiga leder att välja bland. Perfekta för jogging eller längre turer. Men det bästa är att du nu kan skapa och spara personliga rutter. Upptäck nya vägar, testa olika sträckor och gör varje promenad till ditt eget äventyr 🌷☀️",
    image: require("../assets/images/spring.jpg"),
  },
  {
    title: "Nu blir det enklare än någonsin att hitta rätt led i Borås! 🌲🥾",
    date: "2026-02-18",
    text: "Nu kan du enkelt se alla leder i Borås samlade i en lista i appen. Sök, filtrera och sortera för att snabbt hitta en tur som passar dig – oavsett nivå eller humör. Ut i naturen på några sekunder. Vilken led testar du först? 🥾",
    image: require("../assets/images/happy.png"),
  },
  {
    title: "Snart i appen! 🎉",
    date: "2026-01-28",
    text: "Vi kommer under 2026 introducera achievements! Promenera, samla steg och poäng, och lås upp titlar och medaljer längs vägen. Ett lekfullt och motiverande sätt att komma igång med rörelse, oavsett om du väljer en kort promenad runt hörnet eller en längre tur nära dig.",
    image: require("../assets/images/winners-news.png"),
  },
  {
    title: "Picke vann igen!🎉 Stigvidds mest promenerade promenad 2025!",
    date: "2026-01-14",
    text: "Pickesjön runt utsågs nyligen till årets mest promenerade promenad i appen! Den lättgångna, cirka 3,5 km långa rundan runt Pickesjön har blivit en favorit för många, med varierande natur och fina stigar nära Borås centrum.",
    image: require("../assets/images/picke.jpg"),
  },
  {
    title: "Snökaos! ❄️ Spana in promenader som du kan gå trots snön!",
    date: "2026-01-10",
    text: "Många av promenaderna vinterunderhålles inte och är därför svåra (ibland omöjliga) att ta sig fram på men här är en lista på favoriter som är tillgängliga även vintertid. Läs hela listan! ➡️",
    image: require("../assets/images/snow-news.jpg"),
  },
];

const { width } = Dimensions.get("window");

const CARD_WIDTH = width * 0.85;
const CARD_SPACING = 15;

export default function MockNews() {
  const theme = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));
    setActiveIndex(index);
  };

  return (
    <View>
      <View style={s.dots}>
        {news.map((_, index) => (
          <View
            key={index}
            style={[
              s.dot,
              {
                backgroundColor: index === activeIndex ? theme.colors.tertiary : theme.colors.primary,
              },
            ]}
          />
        ))}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: 0,
        }}
      >
        {news.map((newsItem, index) => (
          <Card
            key={newsItem.date}
            style={{
              borderRadius: BORDER_RADIUS,
              width: CARD_WIDTH,
              backgroundColor: theme.colors.surface,
              marginRight: index < news.length - 1 ? CARD_SPACING : 0,
            }}
          >
            <View style={s.cardContentContainer}>
              <Text variant="titleMedium" style={s.title}>
                {newsItem.title}
              </Text>
              <Card.Cover source={newsItem.image} style={s.cardCover} />
              <View style={s.newsText}>
                <Text style={s.lineHeight}>{newsItem.text}</Text>
              </View>
              <Button mode="contained" style={s.button}>
                Läs mer här!
              </Button>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  cardContentContainer: {
    height: 450,
    padding: 10,
    position: "relative",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: BORDER_RADIUS,
  },
  title: {
    fontWeight: "bold",
    paddingVertical: 8,
  },
  newsText: {
    paddingHorizontal: 0,
    paddingTop: 15,
  },
  lineHeight: {
    lineHeight: 20,
  },
  cardCover: {
    height: 200,
    borderRadius: BORDER_RADIUS,
  },
  button: {
    position: "absolute",
    bottom: 8,
    right: 8,
    borderRadius: BORDER_RADIUS,
  },
});
