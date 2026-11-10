// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/core/api-error";
import { createHikeSubmission } from "@/api/hike-submissions";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import RouteTrimmer, { fullRange, TrimRange, trimIndices, trimmedPath } from "@/components/map/route-trimmer";
import DialogSection, { DialogListItem } from "@/components/dialog/dialog-section";
import FormTextField from "@/components/form/form-text-field";
import InfoButton from "@/components/display/info-button";
import InfoHeading from "@/components/layout/info-heading";
import ModalFormScrollView from "@/components/form/modal-form-scroll-view";
import SlimButton from "@/components/display/slim-button";
import DifficultyInfoModal from "@/components/trail/difficulty-info-modal";
import { BORDER_RADIUS, MAX_PENDING_SUBMISSIONS } from "@/constants/constants";
import { DIFFICULTIES } from "@/data/trail-content";
import { CreateHikeSubmissionRequest, Hike } from "@/data/types";
import { HIKE_SUBMISSIONS_QUERY_ROOT } from "@/hooks/hike/useMyHikeSubmissions";
import { useModalKeyboardLift } from "@/hooks/useModalKeyboardLift";
import { asTranslationKey } from "@/i18n";
import CoordinateParser from "@/utils/geo/coordinate-parser";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { ParseKeys } from "i18next";
import { useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Checkbox, Divider, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
import { z } from "zod";

// keep-comment: limits mirror CreateHikeSubmissionRequestValidator
const publishFields = z.object({
  name: z.string().trim().min(3, "publish.nameTooShort").max(80, "publish.nameTooLong"),
  description: z.string().trim().min(1, "publish.descriptionRequired").max(2000, "publish.maxChars2000"),
  classification: z.number().int().min(1, "publish.difficultyRequired").max(3, "publish.difficultyRequired"),
  gettingThere: z.string().trim().min(1, "publish.gettingThereRequired").max(500, "publish.maxChars500"),
  parking: z.string().max(500, "publish.maxChars500"),
  publicTransport: z.string().max(500, "publish.maxChars500"),
  accessibilityInfo: z.string().max(200, "publish.maxChars200"),
  city: z.string().trim().min(1, "publish.cityRequired").max(30, "publish.maxChars30"),
});

type PublishFormFields = z.infer<typeof publishFields>;

const ABOUT_INFO: { heading: ParseKeys; text: ParseKeys; example?: ParseKeys }[] = [
  {
    heading: "publish.aboutInfo.name.heading",
    text: "publish.aboutInfo.name.text",
    example: "publish.aboutInfo.name.example",
  },
  { heading: "publish.aboutInfo.city.heading", text: "publish.aboutInfo.city.text" },
  { heading: "publish.aboutInfo.description.heading", text: "publish.aboutInfo.description.text" },
  {
    heading: "publish.aboutInfo.variation.heading",
    text: "publish.aboutInfo.variation.text",
    example: "publish.aboutInfo.variation.example",
  },
  {
    heading: "publish.aboutInfo.gettingThere.heading",
    text: "publish.aboutInfo.gettingThere.text",
    example: "publish.aboutInfo.gettingThere.example",
  },
  { heading: "publish.aboutInfo.parking.heading", text: "publish.aboutInfo.parking.text" },
];

interface Props {
  hike: Hike;
  nickName: string;
  onDismiss: () => void;
}

// keep-comment: must match HikeSubmissionConsent in the backend; bump both when publish.consent or consentNote changes
export const PUBLISH_CONSENT_VERSION = "2026-10-19";

// keep-comment: mounted only while open, so the form always starts from the hike's current values
export default function PublishHikeModal({ hike, nickName, onDismiss }: Props) {
  const theme = useTheme();
  const { modalStyle, maxHeight } = useModalKeyboardLift(0.9);
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const setErrorMsg = useSetAtom(showErrorAtom);
  const setSuccessMsg = useSetAtom(showSuccessAtom);

  const path = useMemo(
    () => CoordinateParser({ data: hike.coordinates ?? "", identifier: hike.identifier }),
    [hike.coordinates, hike.identifier],
  );
  const [trim, setTrim] = useState<TrimRange>(() => fullRange(path));
  const trimLeavesPath = trimmedPath(path, trim).length >= 2;

  const images = hike.images ?? [];
  const [selectedImages, setSelectedImages] = useState<string[]>(() => images.map((i) => i.identifier));
  const [showName, setShowName] = useState(true);
  const [consent, setConsent] = useState(false);
  const [showDifficultyInfo, setShowDifficultyInfo] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PublishFormFields>({
    resolver: zodResolver(publishFields),
    defaultValues: {
      name: hike.name,
      description: hike.description ?? "",
      classification: 0,
      gettingThere: hike.gettingThere ?? "",
      parking: hike.parkingInfo ?? "",
      publicTransport: "",
      accessibilityInfo: "",
      city: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (request: CreateHikeSubmissionRequest) => createHikeSubmission(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [HIKE_SUBMISSIONS_QUERY_ROOT] });
      setSuccessMsg(t("publish.submitted"));
      onDismiss();
    },
    onError: (error) => {
      const status = error instanceof ApiError ? error.status : null;
      if (status === 409 || status === 429) queryClient.invalidateQueries({ queryKey: [HIKE_SUBMISSIONS_QUERY_ROOT] });
      setErrorMsg(
        status === 409
          ? t("publish.alreadySubmitted")
          : status === 429
            ? t("publish.tooManyPending", { count: MAX_PENDING_SUBMISSIONS })
            : t("publish.error"),
      );
    },
  });

  const toggleImage = (identifier: string) =>
    setSelectedImages((current) =>
      current.includes(identifier) ? current.filter((id) => id !== identifier) : [...current, identifier],
    );

  const submit = handleSubmit((data) => {
    const { start, end } = trimIndices(path, trim);
    mutation.mutate({
      hikeIdentifier: hike.identifier,
      name: data.name.trim(),
      description: data.description.trim(),
      classification: data.classification,
      gettingThere: data.gettingThere.trim(),
      parking: data.parking.trim() || null,
      publicTransport: data.publicTransport.trim() || null,
      accessibilityInfo: data.accessibilityInfo.trim() || null,
      city: data.city.trim(),
      showSubmitterName: showName,
      acceptTransfer: consent,
      consentVersion: PUBLISH_CONSENT_VERSION,
      consentLocale: i18n.language,
      trimStartIndex: start,
      trimEndIndex: end,
      imageIdentifiers: selectedImages,
    });
  });

  const canSubmit = consent && trimLeavesPath && !mutation.isPending;

  return (
    <Portal>
      <Modal visible onDismiss={onDismiss} style={modalStyle} contentContainerStyle={s.container}>
        <View testID="publish-card" style={[s.inner, { backgroundColor: theme.colors.surface }, { maxHeight }]}>
          <View style={s.header}>
            <Icon source="upload" size={18} color={theme.colors.primary} />
            <Text variant="titleMedium" style={[s.title, { color: theme.colors.onSurface }]}>
              {t("publish.title")}
            </Text>
            <Pressable
              testID="publish-close"
              hitSlop={12}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <Icon size={24} source="close" color={theme.colors.onSurface} />
            </Pressable>
          </View>
          <Divider />
          <ModalFormScrollView style={s.scroll} contentContainerStyle={s.content}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>{t("publish.intro")}</Text>

            <View style={s.section}>
              <Text variant="titleSmall">{t("publish.trimTitle")}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {t("publish.trimHint")}
              </Text>
              <RouteTrimmer idPrefix="publish" path={path} trim={trim} onTrimChange={setTrim} />
            </View>

            <View style={s.section}>
              <InfoHeading
                label={t("publish.aboutTitle")}
                labelVariant="titleSmall"
                infoTitle={t("publish.aboutInfoTitle")}
                infoIcon="pencil-outline"
                infoIntro={t("publish.aboutInfoIntro")}
              >
                {ABOUT_INFO.map((section) => (
                  <DialogSection
                    key={section.heading}
                    heading={t(section.heading)}
                    text={t(section.text)}
                    example={section.example && t(section.example)}
                  />
                ))}
              </InfoHeading>
              <FormTextField
                name="name"
                testID="publish-name"
                label={t("publish.name")}
                control={control}
                error={errors.name}
                maxLength={80}
              />
              <FormTextField
                name="city"
                testID="publish-city"
                label={t("publish.city")}
                control={control}
                error={errors.city}
                maxLength={30}
              />
              <FormTextField
                name="description"
                testID="publish-description"
                label={t("publish.description")}
                control={control}
                error={errors.description}
                maxLength={2000}
                multiline
              />
              <FormTextField
                name="accessibilityInfo"
                testID="publish-accessibilityInfo"
                label={t("publish.variationOptional")}
                control={control}
                error={errors.accessibilityInfo}
                maxLength={200}
                multiline
              />
              <View style={s.labelRow}>
                <Text variant="labelLarge">{t("publish.difficulty")}</Text>
                <InfoButton
                  testID="publish-difficulty-help"
                  accessibilityLabel={t("trail.difficultiesTitle")}
                  onPress={() => setShowDifficultyInfo(true)}
                />
              </View>
              <Controller
                control={control}
                name="classification"
                render={({ field: { onChange, value } }) => (
                  <View style={s.difficultyRow}>
                    {DIFFICULTIES.filter((d) => d.value > 0).map((d) => {
                      const selected = value === d.value;
                      return (
                        <Pressable
                          key={d.value}
                          testID={`publish-difficulty-${d.value}`}
                          onPress={() => onChange(d.value)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          style={[
                            s.difficultyButton,
                            {
                              borderColor: selected ? theme.colors.primary : theme.colors.outline,
                              backgroundColor: selected ? theme.colors.primary : "transparent",
                            },
                          ]}
                        >
                          <Text style={{ color: selected ? theme.colors.onPrimary : theme.colors.onSurface }}>
                            {t(asTranslationKey(d.label))}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              />
              {errors.classification?.message && (
                <Text style={[s.errorText, { color: theme.colors.error }]}>
                  {t(asTranslationKey(errors.classification.message))}
                </Text>
              )}
              <FormTextField
                name="gettingThere"
                testID="publish-gettingThere"
                label={t("publish.gettingThere")}
                control={control}
                error={errors.gettingThere}
                maxLength={500}
                multiline
              />
              <FormTextField
                name="parking"
                testID="publish-parking"
                label={t("publish.parkingOptional")}
                control={control}
                error={errors.parking}
                maxLength={500}
                multiline
              />
              <FormTextField
                name="publicTransport"
                testID="publish-publicTransport"
                label={t("publish.publicTransportOptional")}
                control={control}
                error={errors.publicTransport}
                maxLength={500}
                multiline
              />
            </View>

            <View style={s.section}>
              <InfoHeading
                label={t("publish.imagesTitle")}
                labelVariant="titleSmall"
                infoTitle={t("publish.imagesInfoTitle")}
                infoIcon="camera-outline"
              >
                <DialogSection heading={t("publish.imagesInfoDoHeading")}>
                  <DialogListItem icon="check" color={theme.colors.primary} text={t("publish.imagesInfoDaylight")} />
                  <DialogListItem icon="check" color={theme.colors.primary} text={t("publish.imagesInfoNature")} />
                </DialogSection>
                <DialogSection heading={t("publish.imagesInfoAvoidHeading")}>
                  <DialogListItem icon="close" color={theme.colors.error} text={t("publish.imagesInfoPeople")} />
                  <DialogListItem icon="close" color={theme.colors.error} text={t("publish.imagesInfoOffensive")} />
                </DialogSection>
              </InfoHeading>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {images.length > 0 ? t("publish.imagesHint") : t("publish.noImages")}
              </Text>
              <View style={s.imageRow}>
                {images.map((image) => {
                  const selected = selectedImages.includes(image.identifier);
                  return (
                    <Pressable
                      key={image.identifier}
                      testID={`publish-image-${image.identifier}`}
                      onPress={() => toggleImage(image.identifier)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      style={[s.thumbnail, selected && { borderColor: theme.colors.primary }]}
                    >
                      <Image source={{ uri: image.imageUrl }} style={s.thumbnailImage} contentFit="cover" />
                      <View
                        style={[
                          s.check,
                          {
                            backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                            borderColor: selected ? theme.colors.primary : theme.colors.outline,
                          },
                        ]}
                      >
                        {selected && <Icon source="check" size={14} color={theme.colors.onPrimary} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[s.section, s.consentBox, { borderColor: theme.colors.outlineVariant }]}>
              <Text variant="titleSmall">{t("publish.consentTitle")}</Text>
              <Pressable
                testID="publish-show-name"
                style={s.checkRow}
                onPress={() => setShowName((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: showName }}
              >
                <Checkbox.Android status={showName ? "checked" : "unchecked"} color={theme.colors.primary} />
                <Text style={s.checkText}>{t("publish.showName", { nickName })}</Text>
              </Pressable>
              <Pressable
                testID="publish-consent"
                style={s.checkRow}
                onPress={() => setConsent((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
              >
                <Checkbox.Android status={consent ? "checked" : "unchecked"} color={theme.colors.primary} />
                <Text style={s.checkText}>{t("publish.consent")}</Text>
              </Pressable>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {t("publish.consentNote")}
              </Text>
            </View>
          </ModalFormScrollView>
          <View style={s.footer}>
            <SlimButton
              testID="publish-submit"
              style={s.button}
              mode="contained"
              icon="send"
              loading={mutation.isPending}
              disabled={!canSubmit}
              onPress={() => submit()}
            >
              {t("publish.submit")}
            </SlimButton>
          </View>
        </View>
      </Modal>
      <DifficultyInfoModal visible={showDifficultyInfo} onDismiss={() => setShowDifficultyInfo(false)} />
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
  content: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    paddingLeft: 4,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 8,
  },
  difficultyButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
  },
  imageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: BORDER_RADIUS,
    borderWidth: 3,
    borderColor: "transparent",
    overflow: "hidden",
  },
  thumbnailImage: {
    flex: 1,
  },
  check: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: BORDER_RADIUS,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  consentBox: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
    padding: 12,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
  },
  checkText: {
    flex: 1,
  },
  footer: {
    padding: 16,
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
});
