// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ModalFormScrollView from "@/components/modal-form-scroll-view";
import FriendPicker from "@/components/shared-hike/friend-picker";
import { BORDER_RADIUS } from "@/constants/constants";
import { useModalKeyboardLift } from "@/hooks/useModalKeyboardLift";
import { asTranslationKey } from "@/i18n";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Control, Controller, FieldError, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Checkbox, Divider, Icon, Modal, Portal, Text, TextInput, useTheme } from "react-native-paper";
import { z } from "zod";

// Limits mirror CreateHikeRequestValidator; the message key follows the limit. keep-comment: links to the backend validator
const maxChars = (max: 200 | 500) => z.string().max(max, `hike.maxChars${max}`).optional();

const additionalHikeFields = z.object({
  gettingThere: maxChars(200),
  parkingInfo: maxChars(200),
  description: maxChars(500),
  allowResharing: z.boolean().optional(),
});

export type ShareHikeFormFields = z.infer<typeof additionalHikeFields>;

interface FormFieldProps {
  name: "gettingThere" | "parkingInfo" | "description";
  label: string;
  control: Control<ShareHikeFormFields>;
  error?: FieldError;
}

function FormField({ name, label, control, error }: FormFieldProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={s.field}>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            testID={`share-${name}`}
            error={!!error}
            style={[s.textInput, { backgroundColor: theme.colors.surfaceVariant }]}
            onBlur={onBlur}
            onChangeText={(text) => onChange(text || "")}
            value={value ?? ""}
            label={label}
            autoCapitalize="sentences"
            keyboardType="default"
            textAlignVertical="top"
            multiline
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
  visible: boolean;
  onDismiss: () => void;
  onShare: (friendNickNames: string[], formData: ShareHikeFormFields) => void;
  isPending?: boolean;
  defaultValues?: ShareHikeFormFields;
  preselectedNickNames?: string[];
}

export default function ShareHikeModal({
  visible,
  onDismiss,
  onShare,
  isPending,
  defaultValues,
  preselectedNickNames,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [step, setStep] = useState<"form" | "friends">("form");
  const [formData, setFormData] = useState<ShareHikeFormFields>({});
  const { modalStyle, maxHeight } = useModalKeyboardLift(0.85);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ShareHikeFormFields>({ resolver: zodResolver(additionalHikeFields), defaultValues });

  const onSubmit: SubmitHandler<ShareHikeFormFields> = (data) => {
    setFormData(data);
    setStep("friends");
  };

  const handleDismiss = () => {
    setStep("form");
    onDismiss();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={handleDismiss} style={modalStyle} contentContainerStyle={s.container}>
        <View style={[s.inner, { backgroundColor: theme.colors.surface, height: maxHeight }]}>
          <View style={s.header}>
            <Icon source="share" size={18} color={theme.colors.primary} />
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              {t("hike.shareWithFriend")}
            </Text>
            <Pressable
              hitSlop={12}
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <Icon size={24} source="close" color={theme.colors.onSurface} />
            </Pressable>
          </View>
          <Divider />
          {step === "form" ? (
            <>
              <ModalFormScrollView style={s.flex} contentContainerStyle={s.formContent}>
                <View style={{ paddingBottom: 15, gap: 10 }}>
                  <Text variant="titleSmall" style={{ color: theme.colors.secondary }}>
                    {t("hike.shareWarningHeading")}
                  </Text>
                  <Text style={s.infoBody}>{t("hike.shareWarningBody")}</Text>
                  <Text style={s.infoBody}>{t("hike.allowResharingHelp")}</Text>
                  <Controller
                    control={control}
                    name="allowResharing"
                    defaultValue={false}
                    render={({ field: { value, onChange } }) => (
                      <Pressable style={s.checkboxRow} onPress={() => onChange(!value)}>
                        <Checkbox.Android
                          status={value ? "checked" : "unchecked"}
                          color={theme.colors.primary}
                          uncheckedColor={theme.colors.onSurfaceVariant}
                        />
                        <Text style={s.checkboxLabel}>{t("hike.allowResharingLabel")}</Text>
                      </Pressable>
                    )}
                  />
                  <Divider />
                </View>
                <Text style={s.infoLabel}>{t("hike.gettingThereHeading")}</Text>
                <Text style={s.infoBody}>{t("hike.gettingThereHelp")}</Text>
                <FormField
                  name="gettingThere"
                  label={t("hike.gettingThereOptional")}
                  control={control}
                  error={errors.gettingThere}
                />
                <Text style={s.infoLabel}>{t("hike.parkingHeading")}</Text>
                <Text style={s.infoBody}>{t("hike.parkingHelp")}</Text>
                <FormField
                  name="parkingInfo"
                  label={t("hike.parkingOptional")}
                  control={control}
                  error={errors.parkingInfo}
                />
                <Text style={s.infoLabel}>{t("hike.descriptionHeading")}</Text>
                <Text style={s.infoBody}>{t("hike.descriptionHelp")}</Text>
                <FormField
                  name="description"
                  label={t("hike.descriptionOptional")}
                  control={control}
                  error={errors.description}
                />
              </ModalFormScrollView>
              <View style={s.buttonContainer}>
                <Button
                  mode="contained"
                  icon="arrow-right"
                  style={s.button}
                  contentStyle={s.buttonContent}
                  onPress={handleSubmit(onSubmit)}
                >
                  {t("common.next")}
                </Button>
              </View>
            </>
          ) : (
            <>
              <Pressable hitSlop={12} style={s.backButton} onPress={() => setStep("form")}>
                <Icon size={18} source="arrow-left" color={theme.colors.onSurface} />
                <Text style={{ color: theme.colors.onSurface }}>{t("hike.back")}</Text>
              </Pressable>
              <Divider />
              <FriendPicker
                enabled={visible}
                onShare={(names) => onShare(names, formData)}
                isPending={isPending}
                initialSelected={preselectedNickNames}
              />
            </>
          )}
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  formContent: {
    padding: 16,
    gap: 5,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buttonContainer: {
    padding: 16,
    alignItems: "center",
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
  buttonContent: {
    flexDirection: "row-reverse",
  },
  flex: {
    flex: 1,
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
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  checkboxLabel: {
    flex: 1,
  },
});
