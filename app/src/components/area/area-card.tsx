import { BORDER_RADIUS } from "@/constants/constants";
import { CityArea } from "@/data/types";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { Button, Card, Icon, Text, useTheme } from "react-native-paper";

interface Props {
  area: CityArea;
}

export default function AreaCard({ area }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
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
      style={{ gap: 5 }}
    >
      <Card elevation={0} style={s.borderRadius}>
        <Card.Cover
          style={{ padding: 10, backgroundColor: theme.colors.elevation.level1, borderRadius: BORDER_RADIUS }}
          source={{ uri: area.imageUrl }}
        />
        <Card.Title title={area.name} subtitle={area.location} />
        <Card.Content style={{ paddingTop: 10 }}>
          <Text>{area.description}</Text>
        </Card.Content>
        <Card.Actions>
          <Button mode="text">{t("area.readMore")}</Button>
          <Icon source="chevron-right" size={24} color={theme.colors.primary} />
        </Card.Actions>
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  borderRadius: {
    borderRadius: BORDER_RADIUS,
  },
});
