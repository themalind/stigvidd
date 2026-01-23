import React from "react";
import { Text, View } from "react-native";
import { Button, Dialog, Portal } from "react-native-paper";

interface AlertDialogProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  infoText: string;
  backgroundColor?: string;
  textColor?: string;
}
export default function AlertDialog({
  visible,
  onDismiss,
  infoText,
  title,
  backgroundColor,
  textColor,
}: AlertDialogProps) {
  return (
    <Portal>
      <Dialog
        style={{ backgroundColor: backgroundColor }}
        visible={visible}
        onDismiss={onDismiss}
      >
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <View>
            <Text style={{ fontSize: 15, lineHeight: 24, color: textColor }}>
              {infoText}
            </Text>
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>
            <Text style={{ fontSize: 20, color: textColor }}>Ok</Text>
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
