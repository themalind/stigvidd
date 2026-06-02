import { BorasArea } from "@/data/areas-data";
import { BORDER_RADIUS } from "@/constants/constants";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";

interface Props {
  area: BorasArea;
}

export default function AreaCard({ area }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      key={area.identifier}
      onPress={() =>
        guardedNavigate(() =>
          router.navigate({
            pathname: "/(tabs)/(home)/area/[identifier]",
            params: { identifier: area.identifier },
          }),
        )
      }
      style={s.pressable}
    >
      <Card elevation={0} style={[s.card, { borderColor: theme.colors.outlineVariant }]}>
        <Card.Cover source={area.image} style={s.cover} />
        <Card.Title title={area.name} subtitle={area.location} titleStyle={s.title} subtitleStyle={s.subtitle} />
        <Card.Content style={s.content}>
          <Text style={s.description}>{area.description}</Text>
        </Card.Content>
        <Card.Actions>
          <Button mode="contained" icon="chevron-right" contentStyle={s.buttonContent} labelStyle={s.buttonLabel}>
            Läs mer
          </Button>
        </Card.Actions>
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pressable: {
    gap: 5,
  },
  cover: {
    borderTopLeftRadius: BORDER_RADIUS,
    borderTopRightRadius: BORDER_RADIUS,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  card: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
  },
  title: {
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 13,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  content: {
    paddingTop: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContent: {
    flexDirection: "row-reverse",
  },
  buttonLabel: {
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 11,
  },
});
