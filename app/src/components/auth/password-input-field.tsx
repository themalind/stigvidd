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
  /** Shorter field. Used on register, where four fields have to fit without scrolling. */
  dense?: boolean;
}
const WIDTH = Dimensions.get("screen").width;

export default function PasswordInputField({
  passwordCallback,
  error,
  onBlur,
  label,
  onSubmitEditing,
  returnKeyType,
  dense,
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
      dense={dense}
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
    width: WIDTH * 0.65,
  },
});
