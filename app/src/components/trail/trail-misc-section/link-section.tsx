import { TrailLink } from "@/data/types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";

interface Props {
  links: TrailLink[];
}
export default function LinkSection({ links }: Props) {
  const theme = useTheme();
  return (
    <View style={[s.container, { backgroundColor: theme.colors.secondaryContainer }]}>
      {links.map((link, index) => (
        <View key={link.identifier}>
          {index > 0 && <Divider style={{ backgroundColor: theme.colors.onSurface }} />}
          <Pressable style={s.linkContainer} onPress={() => Linking.openURL(link.link)}>
            <View
              style={[
                s.iconBox,
                { backgroundColor: theme.colors.tertiaryContainer, borderColor: theme.colors.tertiary },
              ]}
            >
              <MaterialCommunityIcons name="link-variant" size={24} color={theme.colors.onTertiaryContainer} />
            </View>
            <Text style={s.propertyText}>{link.title}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    padding: 10,
  },
  linkContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    paddingTop: 15,
    paddingBottom: 15,
  },
  propertyText: {
    flex: 1,
    fontWeight: 700,
  },
  iconBox: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 8,
  },
});
