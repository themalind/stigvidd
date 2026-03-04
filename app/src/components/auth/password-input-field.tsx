import { useState } from "react";
import { Dimensions, ReturnKeyTypeOptions, StyleSheet } from "react-native";
import { TextInput, useTheme } from "react-native-paper";

interface FieldProps {
  passwordCallback?: (password: string) => void;
  error?: boolean;
  onBlur?: () => void;
  label: string;
  onSubmitEditing?: () => void;
  returnKeyType?: ReturnKeyTypeOptions;
}
const WIDTH = Dimensions.get("screen").width;

export default function PasswordInputField({
  passwordCallback,
  error,
  onBlur,
  label,
  onSubmitEditing,
  returnKeyType,
}: FieldProps) {
  const [password, setPassword] = useState("");
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handlePasswordChange = (newPassword: string) => {
    setPassword(newPassword);
    if (passwordCallback) {
      passwordCallback(newPassword);
    }
  };

  return (
    <TextInput
      error={error}
      secureTextEntry={!showPassword}
      value={password}
      onBlur={onBlur}
      onChangeText={handlePasswordChange}
      style={styles.textInput}
      label={label}
      autoCapitalize="none"
      theme={{
        colors: {
          primary: theme.colors.onSurface,
        },
      }}
      right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={toggleShowPassword} />}
      onSubmitEditing={onSubmitEditing}
      returnKeyType={returnKeyType || "done"}
    />
  );
}

const styles = StyleSheet.create({
  textInput: {
    flex: 1,
    width: WIDTH * 0.65,
  },
});
