// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import FormTextField from "@/components/form-text-field";
import ModalFormScrollView from "@/components/modal-form-scroll-view";
import { BORDER_RADIUS } from "@/constants/constants";
import { Hike } from "@/data/types";
import { useModalKeyboardLift } from "@/hooks/useModalKeyboardLift";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Divider, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
import { z } from "zod";

// keep-comment: limits mirror UpdateHikeRequestValidator; the name rules match the save form
const maxChars = (max: 200 | 500) => z.string().max(max, `hike.maxChars${max}`);

const editHikeFields = z.object({
  name: z.string().min(3, "hike.nameTooShort").max(40, "hike.nameTooLong"),
  gettingThere: maxChars(200),
  parkingInfo: maxChars(200),
  description: maxChars(500),
});

export type EditHikeFormFields = z.infer<typeof editHikeFields>;

interface Props {
  hike: Hike;
  onDismiss: () => void;
  onSave: (data: EditHikeFormFields) => void;
  isPending?: boolean;
}

// keep-comment: mounted only while open, so the form always starts from the hike's current values
export default function EditHikeModal({ hike, onDismiss, onSave, isPending }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { modalStyle, maxHeight } = useModalKeyboardLift(0.85);

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
      <Modal visible onDismiss={onDismiss} style={modalStyle} contentContainerStyle={s.container}>
        <View testID="edit-hike-card" style={[s.inner, { backgroundColor: theme.colors.surface }, { maxHeight }]}>
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
          <ModalFormScrollView style={s.scroll} contentContainerStyle={s.formContent}>
            <FormTextField
              name="name"
              testID="edit-name"
              label={t("hike.name")}
              control={control}
              error={errors.name}
              maxLength={40}
            />
            <FormTextField
              name="gettingThere"
              testID="edit-gettingThere"
              label={t("hike.gettingThereOptional")}
              control={control}
              error={errors.gettingThere}
              maxLength={200}
              multiline
            />
            <FormTextField
              name="parkingInfo"
              testID="edit-parkingInfo"
              label={t("hike.parkingOptional")}
              control={control}
              error={errors.parkingInfo}
              maxLength={200}
              multiline
            />
            <FormTextField
              name="description"
              testID="edit-description"
              label={t("hike.descriptionOptional")}
              control={control}
              error={errors.description}
              maxLength={500}
              multiline
            />
          </ModalFormScrollView>
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
    gap: 14,
  },
  buttonContainer: {
    padding: 16,
    alignItems: "center",
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
});
