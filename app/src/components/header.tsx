import { MaterialIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";
import SettingsDrawer from "./settings/drawer";

// https://www.youtube.com/watch?v=yzkTDFErTec
// https://www.reddit.com/r/reactnative/comments/jbk2fh/animate_icon_and_expand_text_input_similar_to/
const search = z.object({
  searchString: z.string({ message: "För att söka ange ett sökord" }),
});
type FormFields = z.infer<typeof search>;

export default function Header() {
  const [visible, setVisible] = useState(false);
  const theme = useTheme();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({ resolver: zodResolver(search) });
  const onSubmit: SubmitHandler<FormFields> = async (data) => {};

  return (
    <SafeAreaView style={{ backgroundColor: theme.colors.outlineVariant }} edges={["top"]}>
      <View style={[s.container, { backgroundColor: theme.colors.outlineVariant }]}>
        <View style={s.stigviddContainer}>
          <Image style={s.image} source={require("../assets/images/mammaapp.png")} />
          <Text style={[s.text, { color: theme.colors.onSurfaceVariant }]}>Stigvidd</Text>
        </View>
        <View style={s.iconContainer}>
          <Pressable hitSlop={12}>
            <MaterialIcons name="search" size={24} color={theme.colors.onSurfaceVariant} />
          </Pressable>
          <Pressable hitSlop={12} onPress={() => setVisible(true)}>
            <MaterialIcons name="settings" size={24} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>
      </View>
      <SettingsDrawer visible={visible} onDismiss={() => setVisible(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
  },
  stigviddContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 10,
  },
  text: {
    fontSize: 20,
  },
  image: {
    height: 35,
    width: 35,
    resizeMode: "contain",
    alignSelf: "center",
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    paddingRight: 10,
  },
});
