import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useTheme } from "react-native-paper";

export default function LoadingIndicator() {
  const theme = useTheme();
  return (
    <View style={[s.loading, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator
        size="large"
        animating={true}
        color={theme.colors.primary}
      />
    </View>
  );
}

const s = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
