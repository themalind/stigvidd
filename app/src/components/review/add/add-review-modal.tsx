import { BlurView } from "expo-blur";
import { Dimensions, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Modal, Portal, Text, useTheme } from "react-native-paper";
import AddReviewForm from "./add-review-form";
const { height } = Dimensions.get("screen");

interface AddReviewProps {
  trailIdentifier: string;
  trailName: string;
  trailLenght: number;
  visible: boolean;
  onDismiss: () => void;
}

export default function AddReview({ visible, onDismiss, trailIdentifier, trailName, trailLenght }: AddReviewProps) {
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
          <View style={s.topTextContainer}>
            <Text style={s.title}>Skapa en recension</Text>
            <Text style={s.text}>{`${trailName} ${trailLenght} km`}</Text>
          </View>
          <AddReviewForm trailIdentifier={trailIdentifier} onSuccess={onDismiss} />
        </KeyboardAwareScrollView>
      </Modal>
    </Portal>
  );
}
const s = StyleSheet.create({
  modalContainerStyle: {
    height: height * 0.8,
    borderRadius: 10,
    padding: 10,
  },
  topTextContainer: {
    gap: 10,
    padding: 10,
  },
  scrollContent: {
    flexGrow: 1,
  },
  title: {
    fontSize: 25,
    fontWeight: 600,
  },
  text: {
    fontSize: 20,
  },
});
