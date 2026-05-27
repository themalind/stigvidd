import { BorasArea } from "@/data/areas-data";
import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";
import { Pressable } from "react-native";
import { Button, Card, Icon, Text, useTheme } from "react-native-paper";

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
      style={{ gap: 5 }}
    >
      <Card>
        <Card.Cover style={{ padding: 10, backgroundColor: theme.colors.elevation.level1 }} source={area.image} />
        <Card.Title title={area.name} subtitle={area.location} />
        <Card.Content style={{ paddingTop: 10 }}>
          <Text>{area.description}</Text>
        </Card.Content>
        <Card.Actions>
          <Button mode="text">Läs mer</Button>
          <Icon source="chevron-right" size={24} color={theme.colors.primary} />
        </Card.Actions>
      </Card>
    </Pressable>
  );
}
