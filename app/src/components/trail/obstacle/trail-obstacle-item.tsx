import { BORDER_RADIUS } from "@/constants/constants";
import { TrailObstacle } from "@/data/types";
import { formatDate } from "@/utils/format-date";
import issueTypeParser from "@/utils/issue-type-parser";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";

interface Props {
  obstacle: TrailObstacle;
}

export default function TrailObstacleItem({ obstacle }: Props) {
  const theme = useTheme();
  return (
    <View style={[s.container, { borderColor: theme.colors.outlineVariant }]}>
      <View style={s.row}>
        <Text style={s.bold}>Kategori: </Text>
        <Text>{issueTypeParser(obstacle.issueType)}</Text>
      </View>
      <Divider bold />
      <View>
        <Text style={s.bold}>Beskrivning: </Text>
        <Text>{obstacle.description}</Text>
      </View>
      <View style={s.footer}>
        <View style={s.row}>
          <Text style={s.bold}>Datum: </Text>
          <Text>{formatDate(obstacle.createdAt)}</Text>
        </View>
        <View style={s.voteRow}>
          <Text style={s.voteCount}>{obstacle.solvedVotes?.length ?? 0}/3</Text>
          <Pressable hitSlop={12}>
            <MaterialIcons size={24} name="task-alt" color={theme.colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

//<MaterialIcons name="check-circle" />

const s = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderRadius: BORDER_RADIUS,
    padding: 10,
    gap: 5,
  },
  row: {
    flexDirection: "row",
  },
  bold: {
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  voteCount: {
    opacity: 0.6,
    fontSize: 12,
  },
});
