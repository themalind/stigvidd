import { Picker } from "@react-native-picker/picker";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectInputProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export default function SelectInput({ selectedValue, onValueChange, options, placeholder }: SelectInputProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const selectedLabel = options.find((o) => o.value === selectedValue)?.label ?? placeholder ?? "Välj...";

  if (Platform.OS === "android") {
    return (
      <Picker
        dropdownIconColor={theme.colors.onSurface}
        style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surfaceVariant }}
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        mode="dialog"
      >
        {options.map((opt) => (
          <Picker.Item
            key={opt.value}
            label={opt.label}
            value={opt.value}
            style={{ color: theme.colors.onSurface, backgroundColor: theme.colors.surfaceVariant }}
          />
        ))}
      </Picker>
    );
  }

  return (
    <>
      <Pressable
        style={[s.button, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outline }]}
        onPress={() => setOpen(true)}
      >
        <Text style={{ color: theme.colors.onSurface, flex: 1 }}>{selectedLabel}</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
        <View style={[s.sheet, { backgroundColor: theme.colors.surface }]}>
          <View style={[s.header, { borderBottomColor: theme.colors.outline }]}>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={{ color: theme.colors.primary, fontSize: 16 }}>Klar</Text>
            </Pressable>
          </View>
          <Picker selectedValue={selectedValue} onValueChange={(val) => onValueChange(val)}>
            {options.map((opt) => (
              <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
            ))}
          </Picker>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 4,
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    paddingBottom: 20,
    maxHeight: "50%",
  },
  header: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
