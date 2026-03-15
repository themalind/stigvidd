import { BORDER_RADIUS } from "@/constants/constants";
import { TrailObstacle } from "@/data/types";
import { BlurView } from "expo-blur";
import React from "react";
import { Dimensions, ScrollView, StyleSheet, View } from "react-native";
import { Modal, Portal, Text, useTheme } from "react-native-paper";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  obstacles: TrailObstacle[] | undefined;
}

const { height } = Dimensions.get("screen");

const formatDate = (dateString: string): string => {
  return dateString.split("T")[0];
};

export default function TrailObstacleModal({ visible, onDismiss, obstacles }: Props) {
  const theme = useTheme();
  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <ScrollView>
          {obstacles?.map((obstacle) => (
            <View key={obstacle.identifier}>
              <Text>{obstacle.issueType}</Text>
              <Text>{obstacle.description}</Text>
              <Text>{formatDate(obstacle.createdAt)}</Text>
            </View>
          ))}
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  modalContainerStyle: {
    height: height * 0.8,
    borderRadius: BORDER_RADIUS,
    padding: 10,
  },
});
