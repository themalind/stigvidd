import { BORDER_RADIUS } from "@/constants/constants";
import { guardedNavigate } from "@/utils/navigation";
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
  guardedNavigate(() => router.navigate(route));
};

export default function ProfileMenuItem({ text, route, icon, badge }: MenuItemProps) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => handlePress(route)}>
      <View
        style={[s.containerView, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
      >
        <View style={s.userInfo}>
          {icon}
          <Text style={s.choiceText}>{text}</Text>
        </View>
        <View style={s.right}>
          {badge !== undefined && badge > 0 && (
            <Badge size={24} style={{ backgroundColor: theme.colors.tertiary, color: theme.colors.onTertiary }}>
              {badge}
            </Badge>
          )}
          <MaterialIcons name="chevron-right" size={24} color={theme.colors.onSurface} />
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
    borderWidth: StyleSheet.hairlineWidth,
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
