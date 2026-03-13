import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface Props {
  fullDescription: string;
}

export default function FullDescriptionSection({ fullDescription }: Props) {
  const theme = useTheme();
  return (
    <View style={[s.propertyContainer, { backgroundColor: theme.colors.secondaryContainer }]}>
      <Text style={s.propertyText}>{fullDescription}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  propertyContainer: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  propertyText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 25,
  },
});
