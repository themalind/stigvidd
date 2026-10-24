// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { createTrailObstacle, getObstacleIssueTypes } from "@/api/trail-obstacles";
import { asTranslationKey } from "@/i18n";
import { getCoordinatesByTrailIdentifier } from "@/api/trails";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import CountedTextInput from "@/components/counted-text-input";
import ModalFormScrollView from "@/components/modal-form-scroll-view";
import SelectInput from "@/components/select-input";
import { BORDER_RADIUS } from "@/constants/constants";
import { useModalKeyboardLift } from "@/hooks/useModalKeyboardLift";
import { CreateTrailObstacleRequest } from "@/data/types";
import CoordinateParser from "@/utils/coordinate-parser";
import { isNearTrail } from "@/utils/haversine";
import issueTypeParser from "@/utils/issue-type-parser";
import { MaterialIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ISSUE_TYPES_STALE_TIME, TRAIL_COORDINATES_STALE_TIME } from "@/constants/cache";
import ModalScrim from "@/components/dialog/modal-scrim";
import * as ExpoLinking from "expo-linking";
import * as Location from "expo-location";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { ActivityIndicator, Button, Modal, Portal, Surface, Text, useTheme } from "react-native-paper";
import { z } from "zod";
import { logger } from "../../../services/logger";

const obstacleFields = z.object({
  description: z
    .string({ required_error: "obstacle.descriptionRequired" })
    .trim()
    .min(15, "obstacle.descriptionTooShort")
    .max(500, "obstacle.descriptionMax"),
  issueType: z.string().nonempty("obstacle.categoryRequired"),
  useLocation: z.boolean().optional(),
  incidentLatitude: z.number().nullable().optional(),
  incidentLongitude: z.number().nullable().optional(),
});

type FormFields = z.infer<typeof obstacleFields>;

interface Props {
  trailIdentifier: string;
  visible: boolean;
  onDismiss: () => void;
}

export default function TrailObstacleForm({ trailIdentifier, visible, onDismiss }: Props) {
  const { t } = useTranslation();
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const theme = useTheme();
  const setErrorMsg = useSetAtom(showErrorAtom);
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const queryClient = useQueryClient();
  const { modalStyle, maxHeight } = useModalKeyboardLift(0.8);

  // keep-comment: always mounted inside UserBar, so the visible gate stops these firing on every trail-detail load
  const { data: issueTypes } = useQuery({
    queryKey: ["issueTypes", "obstacle"],
    queryFn: () => getObstacleIssueTypes(),
    enabled: visible,
    staleTime: ISSUE_TYPES_STALE_TIME,
  });

  const { data: trailCords } = useQuery({
    queryKey: ["cords", trailIdentifier],
    queryFn: () => getCoordinatesByTrailIdentifier(trailIdentifier),
    enabled: visible && !!trailIdentifier,
    staleTime: TRAIL_COORDINATES_STALE_TIME,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (obstacle: CreateTrailObstacleRequest) => createTrailObstacle(obstacle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obstacles", trailIdentifier] });
      reset();
      onDismiss();
      setSuccessMsg(t("obstacle.reportSuccess"));
    },
    onError: () => {
      setErrorMsg(t("obstacle.reportError"));
    },
  });

  const parsed = trailCords ? CoordinateParser({ data: trailCords.coordinates, identifier: trailIdentifier }) : [];
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormFields>({
    resolver: zodResolver(obstacleFields),
    defaultValues: {
      issueType: "Other",
      useLocation: false,
      incidentLatitude: null,
      incidentLongitude: null,
    },
  });

  const onSubmit: SubmitHandler<FormFields> = (data) => {
    const newObstacle: CreateTrailObstacleRequest = {
      trailIdentifier,
      description: data.description,
      issueType: data.issueType,
      incidentLatitude: data.incidentLatitude ?? null,
      incidentLongitude: data.incidentLongitude ?? null,
    };

    mutate(newObstacle);
  };

  const handleLocationToggle = async (enabled: boolean, onChange: (val: boolean) => void) => {
    if (!enabled) {
      onChange(false);
      setValue("incidentLatitude", null);
      setValue("incidentLongitude", null);
      setLocationError(null);
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    try {
      const { granted } = await Location.getForegroundPermissionsAsync();

      if (!granted) {
        setLocationError(t("obstacle.locationPermissionMissing"));
        await ExpoLinking.openSettings();
        return;
      }

      const location =
        (await Location.getLastKnownPositionAsync({ maxAge: 30000, requiredAccuracy: 100 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));

      if (parsed.length === 0 || !isNearTrail(location.coords.latitude, location.coords.longitude, parsed)) {
        setLocationError(t("obstacle.notOnTrail"));
        return;
      }

      onChange(true);
      setValue("incidentLatitude", location.coords.latitude);
      setValue("incidentLongitude", location.coords.longitude);
    } catch (e) {
      logger.warn("Could not read the current position for an obstacle report", { error: String(e) });
      setLocationError(t("obstacle.locationError"));
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <Portal>
      {visible && <ModalScrim />}
      <Modal
        style={modalStyle}
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface, height: maxHeight }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <View style={s.keyboardAvoidingView}>
          <View style={s.modalContentContainer}>
            <View style={s.header}>
              <View style={s.headerLeft}>
                <MaterialIcons name="warning-amber" size={18} color={theme.colors.error} />
                <Text style={s.title}>{t("obstacle.reportTitle")}</Text>
              </View>
              <Pressable hitSlop={12} onPress={onDismiss}>
                <MaterialIcons name="close" size={24} color={theme.colors.onSurface} />
              </Pressable>
            </View>

            <Surface style={s.surface}>
              <Text style={[s.infoLabel, { color: theme.colors.onSurfaceVariant }]}>{t("obstacle.formInfo1")}</Text>
              <Text style={[s.infoBody, { color: theme.colors.onSurfaceVariant }]}>{t("obstacle.formInfo2")}</Text>
            </Surface>

            <ModalFormScrollView style={s.scrollView} contentContainerStyle={s.scrollContent}>
              <View style={s.fieldGroup}>
                <Text style={[s.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {t("obstacle.selectCategory")}
                </Text>
                {issueTypes?.length && (
                  <Controller
                    control={control}
                    name="issueType"
                    render={({ field: { onChange, value } }) => (
                      <SelectInput
                        selectedValue={value}
                        onValueChange={onChange}
                        options={issueTypes.map((type) => ({ label: issueTypeParser(type), value: type }))}
                      />
                    )}
                  />
                )}
                {errors.issueType?.message && (
                  <Text style={[s.bold, { color: theme.colors.error }]}>
                    {t(asTranslationKey(errors.issueType.message))}
                  </Text>
                )}
              </View>
              <View style={s.fieldGroup}>
                <Text style={[s.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {t("obstacle.descriptionLabel")}
                </Text>
                <Controller
                  control={control}
                  name="description"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <CountedTextInput
                      testID="obstacle-description"
                      mode="outlined"
                      error={!!errors.description}
                      style={[s.textInput, { backgroundColor: theme.colors.surfaceVariant }]}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      maxLength={500}
                      label={t("obstacle.description")}
                      autoCapitalize="sentences"
                      multiline
                      scrollEnabled={false}
                      textAlignVertical="top"
                      theme={{ colors: { primary: theme.colors.onSurface } }}
                    />
                  )}
                />
                <Text style={[s.privacyInfo, { color: theme.colors.onSurfaceVariant }]}>
                  {t("obstacle.descriptionPrivacyInfo")}
                </Text>
                {errors.description?.message && (
                  <Text style={[s.bold, { color: theme.colors.error }]}>
                    {t(asTranslationKey(errors.description.message))}
                  </Text>
                )}
              </View>
              <View style={s.locationRow}>
                <Text style={[s.locationLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {t("obstacle.shareLocation")}
                </Text>
                <Controller
                  control={control}
                  name="useLocation"
                  render={({ field: { value, onChange } }) => (
                    <Switch
                      testID="obstacle-location-switch"
                      trackColor={{ false: theme.colors.outlineVariant, true: theme.colors.tertiary }}
                      thumbColor={value ? theme.colors.outlineVariant : theme.colors.tertiary}
                      style={s.switch}
                      value={value || isLocating}
                      disabled={isLocating}
                      onValueChange={(enabled) => handleLocationToggle(enabled, onChange)}
                    />
                  )}
                />
              </View>
              {isLocating && (
                <View style={s.locatingRow}>
                  <ActivityIndicator size="small" color={theme.colors.tertiary} />
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>{t("obstacle.locating")}</Text>
                </View>
              )}
              {!isLocating && watch("useLocation") && <Text>{t("obstacle.locationAttached")}</Text>}
              {locationError && <Text style={[s.bold, { color: theme.colors.error }]}>{locationError}</Text>}
            </ModalFormScrollView>

            <Button
              testID="obstacle-submit"
              onPress={handleSubmit(onSubmit)}
              mode="contained"
              style={s.button}
              disabled={isPending}
            >
              {isPending ? t("common.sending") : t("common.send")}
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  modalContainerStyle: {
    justifyContent: "flex-start",
    borderRadius: BORDER_RADIUS,
    padding: 15,
    gap: 5,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalContentContainer: {
    flex: 1,
    gap: 20,
    justifyContent: "flex-start",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 25,
  },
  surface: {
    padding: 10,
    gap: 5,
    justifyContent: "flex-start",
  },
  textInput: {
    width: "100%",
    minHeight: 80,
  },
  header: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    paddingTop: 10,
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  title: {
    fontWeight: "700",
    fontSize: 18,
    letterSpacing: 0.4,
  },
  bold: {
    fontWeight: "700",
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
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldGroup: {
    gap: 5,
  },
  privacyInfo: {
    fontSize: 12,
    lineHeight: 18,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
    padding: 5,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  locatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  switch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  button: {
    borderRadius: BORDER_RADIUS,
  },
});
