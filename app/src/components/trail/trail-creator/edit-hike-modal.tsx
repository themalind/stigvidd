// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { BORDER_RADIUS } from "@/constants/constants";
import { Hike } from "@/data/types";
import { asTranslationKey } from "@/i18n";
import { zodResolver } from "@hookform/resolvers/zod";
import { Control, Controller, FieldError, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Button, Divider, Icon, Modal, Portal, Text, TextInput, useTheme } from "react-native-paper";
import { z } from "zod";

const HEIGHT = Dimensions.get("screen").height;

// Limits mirror UpdateHikeRequestValidator; the name rules match the save form.
const maxChars = (max: 200 | 500) => z.string().max(max, `hike.maxChars${max}`);

const editHikeFields = z.object({
  name: z.string().min(3, "hike.nameTooShort").max(40, "hike.nameTooLong"),
  gettingThere: maxChars(200),
  parkingInfo: maxChars(200),
  description: maxChars(500),
});

export type EditHikeFormFields = z.infer<typeof editHikeFields>;

interface FormFieldProps {
  name: keyof EditHikeFormFields;
  label: string;
  control: Control<EditHikeFormFields>;
  error?: FieldError;
  maxLength: number;
  multiline?: boolean;
}

function FormField({ name, label, control, error, maxLength, multiline }: FormFieldProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={s.field}>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            testID={`edit-${name}`}
            error={!!error}
            style={[s.textInput, { backgroundColor: theme.colors.surfaceVariant }]}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            label={label}
            maxLength={maxLength}
            autoCapitalize="sentences"
            textAlignVertical="top"
            multiline={multiline}
            theme={{ colors: { onSurfaceVariant: theme.colors.primary } }}
          />
        )}
      />
      {error?.message && (
        <Text
          style={[s.errorBadge, { color: theme.colors.onErrorContainer, backgroundColor: theme.colors.errorContainer }]}
        >
          {t(asTranslationKey(error.message))}
        </Text>
      )}
    </View>
  );
}

interface Props {
  hike: Hike;
  onDismiss: () => void;
  onSave: (data: EditHikeFormFields) => void;
  isPending?: boolean;
}

// Mounted only while open, so the form always starts from the hike's current values.
export default function EditHikeModal({ hike, onDismiss, onSave, isPending }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditHikeFormFields>({
    resolver: zodResolver(editHikeFields),
    defaultValues: {
      name: hike.name,
      gettingThere: hike.gettingThere ?? "",
      parkingInfo: hike.parkingInfo ?? "",
      description: hike.description ?? "",
    },
  });

  const submit: SubmitHandler<EditHikeFormFields> = (data) => onSave(data);

  return (
    <Portal>
      <Modal visible onDismiss={onDismiss} contentContainerStyle={s.container}>
        <View style={[s.inner, { backgroundColor: theme.colors.surface }]}>
          <View style={s.header}>
            <Icon source="pencil" size={18} color={theme.colors.primary} />
            <Text variant="titleMedium" style={[s.title, { color: theme.colors.onSurface }]}>
              {t("hike.editTitle")}
            </Text>
            <Pressable
              hitSlop={12}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <Icon size={24} source="close" color={theme.colors.onSurface} />
            </Pressable>
          </View>
          <Divider />
          <KeyboardAwareScrollView
            style={s.scroll}
            contentContainerStyle={s.formContent}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
          >
            <FormField name="name" label={t("hike.name")} control={control} error={errors.name} maxLength={40} />
            <FormField
              name="gettingThere"
              label={t("hike.gettingThereOptional")}
              control={control}
              error={errors.gettingThere}
              maxLength={200}
              multiline
            />
            <FormField
              name="parkingInfo"
              label={t("hike.parkingOptional")}
              control={control}
              error={errors.parkingInfo}
              maxLength={200}
              multiline
            />
            <FormField
              name="description"
              label={t("hike.descriptionOptional")}
              control={control}
              error={errors.description}
              maxLength={500}
              multiline
            />
          </KeyboardAwareScrollView>
          <View style={s.buttonContainer}>
            <Button
              style={s.button}
              testID="edit-hike-save"
              mode="contained"
              icon="content-save"
              loading={isPending}
              disabled={isPending}
              onPress={handleSubmit(submit)}
            >
              {t("common.save")}
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  container: {
    marginHorizontal: 10,
    borderRadius: BORDER_RADIUS,
  },
  inner: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    maxHeight: HEIGHT * 0.85,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
  },
  title: {
    flex: 1,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  formContent: {
    padding: 16,
  },
  buttonContainer: {
    padding: 16,
    alignItems: "center",
  },
  textInput: {
    width: "100%",
  },
  field: {
    gap: 4,
    marginBottom: 14,
  },
  errorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
});
