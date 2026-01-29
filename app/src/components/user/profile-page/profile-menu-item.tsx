import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";

interface MenuItemProps {
  text: string;
  route: Href;
  icon?: React.ReactNode;
}

const handlePress = (route: Href) => {
  router.push(route);
};

export default function ProfileMenuItem({ text, route, icon }: MenuItemProps) {
  const theme = useTheme();
  return (
    <View style={s.container}>
      <Pressable onPress={() => handlePress(route)}>
        <Surface style={s.surface}>
          <View style={s.userInfo}>
            {icon}
            <Text style={s.choiceText}>{text}</Text>
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
  container: {
    borderRadius: 10,
  },
  surface: {
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    justifyContent: "space-between",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  choiceText: {
    fontWeight: 700,
    fontSize: 16,
  },
});
