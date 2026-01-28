import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";

interface ChoiceProps {
  text: string;
  route: Href;
  icon?: React.ReactNode;
}

const handlePress = (route: Href) => {
  router.push(route);
};

export default function PressableProfileChoice({
  text,
  route,
  icon,
}: ChoiceProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: 10,
      }}
    >
      <Pressable onPress={() => handlePress(route)}>
        <Surface
          style={{
            padding: 15,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 10,
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 20,
            }}
          >
            {icon}
            <Text style={{ fontWeight: 700, fontSize: 16 }}>{text}</Text>
          </View>
          <MaterialCommunityIcons
            name="arrow-right-thin"
            size={30}
            color={theme.colors.onSurface}
          />
        </Surface>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {},
});
