import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { Image, StyleSheet, View } from "react-native";
import { HelperText, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const search = z.object({
  searchString: z.string({ message: "För att söka ange ett sökord" }),
});
type FormFields = z.infer<typeof search>;

export default function Header() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormFields>({ resolver: zodResolver(search) });
  const onSubmit: SubmitHandler<FormFields> = async (data) => {};
  return (
    <SafeAreaView
      style={{ backgroundColor: "#0C290F" }}
      edges={["top", "left", "right"]}
    >
      <View>
        <View style={[s.container, { backgroundColor: "#0C290F" }]}>
          <Image
            style={s.image}
            source={require("../assets/images/mammaapp.png")}
          />
          <View style={s.inputContainer}>
            <Controller
              control={control}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={s.textInput}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  placeholder="Starta din sökning här.."
                  mode="outlined"
                  theme={{ roundness: 25 }}
                  right={
                    <TextInput.Icon
                      icon={() => (
                        <MaterialIcons name="search" size={24} color="grey" />
                      )}
                      onPress={handleSubmit(onSubmit)}
                    />
                  }
                  returnKeyType="search" // <-- Visar "Search" på tangentbordet
                  onSubmitEditing={handleSubmit(onSubmit)} // <-- Kör sökfunktionen vid enter
                />
              )}
              name="searchString"
            />
          </View>
        </View>

        <HelperText
          type="error"
          visible={!!errors.searchString}
          style={{ textAlign: "center" }}
        >
          {errors.searchString?.message}
        </HelperText>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
  },
  image: {
    height: 50,
    width: 50,
    resizeMode: "contain",
    alignSelf: "center",
  },
  inputContainer: {
    flex: 1,
    justifyContent: "center",
  },
  textInput: {
    marginTop: 10,
    height: 40,
  },
});
