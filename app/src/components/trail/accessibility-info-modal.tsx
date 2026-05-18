import { BORDER_RADIUS } from "@/constants/constants";
import { BlurView } from "expo-blur";
import { Dimensions, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Modal, Portal, Text, useTheme } from "react-native-paper";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

const { height } = Dimensions.get("screen");

export default function AccesibilityInfoModal({ visible, onDismiss }: Props) {
  const theme = useTheme();
  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={20}
          contentContainerStyle={s.scrollContent}
        >
          <View>
            <Text>Tillgänglighet</Text>
          </View>
        </KeyboardAwareScrollView>
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
  scrollContent: {
    flexGrow: 1,
  },
});
