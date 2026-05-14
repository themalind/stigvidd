import { BORDER_RADIUS } from "@/constants/constants";
import { MaterialIcons } from "@expo/vector-icons";
import { Href, router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Badge, Text, useTheme } from "react-native-paper";

interface MenuItemProps {
  text: string;
  route: Href;
  icon?: React.ReactNode;
  badge?: number;
}

const handlePress = (route: Href) => {
  router.push(route);
};

export default function ProfileMenuItem({ text, route, icon, badge }: MenuItemProps) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => handlePress(route)}>
      <View style={[s.containerView, { backgroundColor: theme.colors.surface }]}>
        <View style={s.userInfo}>
          {icon}
          <Text style={s.choiceText}>{text}</Text>
        </View>
        <View style={s.right}>
          {badge !== undefined && badge > 0 && <Badge style={{ backgroundColor: theme.colors.primary }}>{badge}</Badge>}
          <MaterialIcons name="chevron-right" size={22} color={theme.colors.onSurface} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  containerView: {
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BORDER_RADIUS,
    justifyContent: "space-between",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  choiceText: {
    fontWeight: "700",
    fontSize: 16,
  },
});
