import { DIALOG_BORDER_RADIUS } from "@/constants/constants";
import React from "react";
import { Text, View } from "react-native";
import { Button, Dialog, Portal } from "react-native-paper";

interface AlertDialogProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  infoText: string[];
  backgroundColor: string;
  textColor?: string;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
}

export default function AlertDialog({
  visible,
  onDismiss,
  infoText,
  title,
  backgroundColor,
  textColor,
  confirmText,
  onConfirm,
  cancelText = "Ok",
}: AlertDialogProps) {
  return (
    <Portal>
      <Dialog
        style={{ backgroundColor: backgroundColor, borderRadius: DIALOG_BORDER_RADIUS }}
        visible={visible}
        onDismiss={onDismiss}
      >
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <View style={{ gap: 10 }}>
            {infoText.map((t, index) => (
              <Text key={index} style={{ fontSize: 15, lineHeight: 24, color: textColor }}>
                {infoText[index]}
              </Text>
            ))}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          {confirmText && onConfirm && (
            <Button onPress={onConfirm}>
              <Text style={{ fontSize: 18, color: textColor }}>{confirmText}</Text>
            </Button>
          )}
          <Button onPress={onDismiss}>
            <Text style={{ fontSize: 18, color: textColor }}>{cancelText}</Text>
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
