// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { createHikeSubmission } from "@/api/hike-submissions";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import Map from "@/components/map/map";
import { routeCasingPaint } from "@/components/map/marker-styles";
import FormTextField from "@/components/form-text-field";
import ModalFormScrollView from "@/components/modal-form-scroll-view";
import DifficultyInfoModal from "@/components/trail/difficulty-info-modal";
import { BORDER_RADIUS } from "@/constants/constants";
import { DIFFICULTIES } from "@/data/trail-content";
import { CreateHikeSubmissionRequest, Hike } from "@/data/types";
import { HIKE_SUBMISSIONS_QUERY_ROOT } from "@/hooks/hike/useMyHikeSubmissions";
import { useModalKeyboardLift } from "@/hooks/useModalKeyboardLift";
import { asTranslationKey } from "@/i18n";
import CoordinateParser from "@/utils/coordinate-parser";
import { formatDistanceKm } from "@/utils/format-distance";
import { lineStringFromPositions } from "@/utils/geojson";
import getBoundsFromTrail from "@/utils/get-bounds-from-trail";
import { haversineDistance } from "@/utils/haversine";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { Slider } from "@miblanchard/react-native-slider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useSetAtom } from "jotai";
import { useCallback, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Checkbox, Divider, Icon, Modal, Portal, Text, useTheme } from "react-native-paper";
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

export function lengthOfPath(path: GeoJSON.Position[]): number {
  let metres = 0;
  for (let i = 1; i < path.length; i++) {
    metres += haversineDistance(path[i - 1][1], path[i - 1][0], path[i][1], path[i][0]);
  }
  return metres;
}

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
  const cameraRef = useRef<CameraRef>(null);

  const path = useMemo(
    () => CoordinateParser({ data: hike.coordinates ?? "", identifier: hike.identifier }),
    [hike.coordinates, hike.identifier],
  );
  const lastIndex = Math.max(0, path.length - 1);
  const [trim, setTrim] = useState<[number, number]>([0, lastIndex]);
  const kept = useMemo(() => path.slice(trim[0], trim[1] + 1), [path, trim]);
  const keptMetres = useMemo(() => lengthOfPath(kept), [kept]);
  const canTrim = path.length > 2;
  const trimLeavesPath = kept.length >= 2;

  const fullShape = useMemo(() => lineStringFromPositions(path), [path]);
  const keptShape = useMemo(() => lineStringFromPositions(kept), [kept]);
  const bounds = useMemo(() => getBoundsFromTrail(path), [path]);
  const fitToRoute = useCallback(() => {
    if (bounds)
      cameraRef.current?.fitBounds(bounds, { padding: { top: 30, right: 30, bottom: 30, left: 30 }, duration: 0 });
  }, [bounds]);

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
      setErrorMsg(error instanceof ApiError && error.status === 409 ? t("publish.alreadyPending") : t("publish.error"));
    },
  });

  const toggleImage = (identifier: string) =>
    setSelectedImages((current) =>
      current.includes(identifier) ? current.filter((id) => id !== identifier) : [...current, identifier],
    );

  const submit = handleSubmit((data) =>
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
      trimStartIndex: trim[0] > 0 ? trim[0] : null,
      trimEndIndex: trim[1] < lastIndex ? trim[1] : null,
      imageIdentifiers: selectedImages,
    }),
  );

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
              {path.length > 1 && (
                <View style={s.mapContainer}>
                  <Map style={s.map} showsUserLocation={false} onDidFinishLoadingMap={fitToRoute}>
                    <Camera ref={cameraRef} />
                    <GeoJSONSource id="publish-route-full" data={fullShape}>
                      <Layer
                        type="line"
                        id="publish-route-full-line"
                        layout={{ "line-join": "round", "line-cap": "round" }}
                        paint={{ "line-color": theme.colors.outline, "line-width": 3, "line-dasharray": [2, 2] }}
                      />
                    </GeoJSONSource>
                    {kept.length > 1 && (
                      <GeoJSONSource id="publish-route-kept" data={keptShape}>
                        <Layer
                          type="line"
                          id="publish-route-kept-casing"
                          layout={{ "line-join": "round", "line-cap": "round" }}
                          paint={routeCasingPaint(4)}
                        />
                        <Layer
                          type="line"
                          id="publish-route-kept-line"
                          layout={{ "line-join": "round", "line-cap": "round" }}
                          paint={{ "line-color": theme.colors.primary, "line-width": 4 }}
                        />
                      </GeoJSONSource>
                    )}
                  </Map>
                </View>
              )}
              {canTrim && (
                <Slider
                  value={trim}
                  minimumValue={0}
                  maximumValue={lastIndex}
                  step={1}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.outline}
                  thumbTintColor={theme.colors.primary}
                  onValueChange={(value) => {
                    const [start, end] = value as number[];
                    setTrim([Math.round(Math.min(start, end)), Math.round(Math.max(start, end))]);
                  }}
                />
              )}
              <Text testID="publish-length" variant="bodySmall">
                {t("publish.newLength", { length: formatDistanceKm(keptMetres / 1000) })}
              </Text>
              {!trimLeavesPath && (
                <Text style={[s.errorText, { color: theme.colors.error }]}>{t("publish.trimTooShort")}</Text>
              )}
            </View>

            <View style={s.section}>
              <Text variant="titleSmall">{t("publish.aboutTitle")}</Text>
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
                <Pressable
                  testID="publish-difficulty-help"
                  hitSlop={16}
                  onPress={() => setShowDifficultyInfo(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("trail.difficultiesTitle")}
                >
                  <Icon source="information" size={17} color={theme.colors.onSurfaceVariant} />
                </Pressable>
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
              <Text variant="titleSmall">{t("publish.imagesTitle")}</Text>
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
            <Button
              testID="publish-submit"
              style={s.button}
              mode="contained"
              icon="send"
              loading={mutation.isPending}
              disabled={!canSubmit}
              onPress={submit}
            >
              {t("publish.submit")}
            </Button>
          </View>
        </View>
      </Modal>
      <DifficultyInfoModal difficulty={0} visible={showDifficultyInfo} onDismiss={() => setShowDifficultyInfo(false)} />
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
  mapContainer: {
    height: 200,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
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
