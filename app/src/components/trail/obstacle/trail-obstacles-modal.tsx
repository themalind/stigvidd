import { BORDER_RADIUS } from "@/constants/constants";
import { TrailObstacle } from "@/data/types";
import { MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Modal, Portal, Text, useTheme } from "react-native-paper";
import TrailObstacleItem from "./trail-obstacle-item";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  obstacles: TrailObstacle[] | undefined;
  trailIdentifier: string;
}

const { height } = Dimensions.get("screen");

export default function TrailObstacleModal({ visible, onDismiss, obstacles, trailIdentifier }: Props) {
  const theme = useTheme();
  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <View style={s.header}>
          <View style={s.headerLeft}>
            <MaterialIcons name="warning-amber" size={18} color={theme.colors.error} />
            <Text style={s.title}>Rapporterade hinder</Text>
          </View>
          <Pressable hitSlop={12} onPress={onDismiss}>
            <MaterialIcons name="close" size={24} color={theme.colors.onSurface} />
          </Pressable>
        </View>
        <View style={[s.infoBox, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={[s.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
            Här visas rapporterade hinder längs leden.
          </Text>
          <Text style={[s.infoBody, { color: theme.colors.onSurfaceVariant }]}>
            Hjälp gärna till genom att markera ett hinder som löst om det är åtgärdat. Det gör du genom att trycka på
            bockikonen (✓) på det hinder du vill markera. Varningen tas bort efter 3 bekräftelser eller 30 dagar.
          </Text>
        </View>
        <ScrollView contentContainerStyle={s.scrollContent} style={s.scrollView} showsVerticalScrollIndicator={false}>
          {obstacles?.map((obstacle) => (
            <TrailObstacleItem key={obstacle.identifier} obstacle={obstacle} trailIdentifier={trailIdentifier} />
          ))}
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  modalContainerStyle: {
    height: height * 0.9,
    borderRadius: BORDER_RADIUS,
    padding: 10,
    gap: 15,
  },
  header: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    paddingTop: 10,
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  title: {
    fontWeight: "700",
    fontSize: 18,
    letterSpacing: 0.4,
  },
  infoBox: {
    borderRadius: BORDER_RADIUS,
    padding: 12,
    gap: 6,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  scrollContent: {
    gap: 15,
  },
  scrollView: {
    flex: 1,
  },
});
