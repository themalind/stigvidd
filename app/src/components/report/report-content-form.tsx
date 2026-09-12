// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { createContentReport, getReportReasons } from "@/api/content-reports";
import { ApiError } from "@/api/api-error";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import SelectInput from "@/components/select-input";
import { REPORT_REASONS_STALE_TIME } from "@/constants/cache";
import { BORDER_RADIUS } from "@/constants/constants";
import { CreateContentReportRequest, ReportedContentType } from "@/data/types";
import { asTranslationKey } from "@/i18n";
import reportReasonParser from "@/utils/report-reason-parser";
import { MaterialIcons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { useSetAtom } from "jotai";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Button, Modal, Portal, Surface, Text, TextInput, useTheme } from "react-native-paper";
import { z } from "zod";

const reportFields = z.object({
  reason: z.string().nonempty("report.reasonRequired"),
  reporterNote: z.string().max(300, "report.noteMax").optional(),
});

type FormFields = z.infer<typeof reportFields>;

const { height } = Dimensions.get("screen");

interface Props {
  contentType: ReportedContentType;
  contentIdentifier: string;
  // The query to invalidate so the reported row leaves the list straight away.
  invalidateQueryKey: unknown[];
  visible: boolean;
  onDismiss: () => void;
}

export default function ReportContentForm({
  contentType,
  contentIdentifier,
  invalidateQueryKey,
  visible,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const setErrorMsg = useSetAtom(showErrorAtom);
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const queryClient = useQueryClient();

  // Gated on visible for the same reason the obstacle form gates its lookups: this sits
  // inside a list row and would otherwise fire once per rendered row.
  const { data: reasons } = useQuery({
    queryKey: ["reportReasons"],
    queryFn: () => getReportReasons(),
    enabled: visible,
    staleTime: REPORT_REASONS_STALE_TIME,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormFields>({
    resolver: zodResolver(reportFields),
    defaultValues: { reason: "Offensive", reporterNote: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (report: CreateContentReportRequest) => createContentReport(report),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateQueryKey });
      reset();
      onDismiss();
      // Neutral on purpose: a reporter over the withholding threshold gets a queued report
      // that hides nothing, and that must not read as a failure.
      setSuccessMsg(t("report.success"));
    },
    onError: (error) => {
      const status = error instanceof ApiError ? error.status : undefined;

      if (status === 409) {
        setErrorMsg(t("report.alreadyReported"));
        return;
      }

      if (status === 429) {
        setErrorMsg(t("report.tooMany"));
        return;
      }

      setErrorMsg(t("report.error"));
    },
  });

  const onSubmit: SubmitHandler<FormFields> = (data) => {
    mutate({
      contentType,
      contentIdentifier,
      reason: data.reason,
      reporterNote: data.reporterNote?.trim() ? data.reporterNote.trim() : undefined,
    });
  };

  return (
    <Portal>
      {visible && <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />}
      <Modal
        contentContainerStyle={[s.modalContainerStyle, { backgroundColor: theme.colors.surface }]}
        visible={visible}
        onDismiss={onDismiss}
      >
        <View style={s.modalContentContainer}>
          <View style={s.header}>
            <View style={s.headerLeft}>
              <MaterialIcons name="flag" size={18} color={theme.colors.error} />
              <Text style={s.title}>{t("report.title")}</Text>
            </View>
            <Pressable hitSlop={12} onPress={onDismiss}>
              <MaterialIcons name="close" size={24} color={theme.colors.onSurface} />
            </Pressable>
          </View>

          <Surface style={s.surface}>
            <Text style={[s.infoLabel, { color: theme.colors.onSurfaceVariant }]}>{t("report.formInfo1")}</Text>
            <Text style={[s.infoBody, { color: theme.colors.onSurfaceVariant }]}>{t("report.formInfo2")}</Text>
          </Surface>

          <KeyboardAwareScrollView
            keyboardShouldPersistTaps="handled"
            style={s.scrollView}
            contentContainerStyle={s.scrollContent}
          >
            <View style={s.fieldGroup}>
              <Text style={[s.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>{t("report.selectReason")}</Text>
              {!!reasons?.length && (
                <Controller
                  control={control}
                  name="reason"
                  render={({ field: { onChange, value } }) => (
                    <SelectInput
                      selectedValue={value}
                      onValueChange={onChange}
                      options={reasons.map((reason) => ({ label: reportReasonParser(reason), value: reason }))}
                    />
                  )}
                />
              )}
              {errors.reason?.message && (
                <Text style={[s.bold, { color: theme.colors.error }]}>
                  {t(asTranslationKey(errors.reason.message))}
                </Text>
              )}
            </View>

            <View style={s.fieldGroup}>
              <Text style={[s.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>{t("report.noteLabel")}</Text>
              <Controller
                control={control}
                name="reporterNote"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    testID="report-note"
                    mode="outlined"
                    error={!!errors.reporterNote}
                    style={[s.textInput, { backgroundColor: theme.colors.surfaceVariant }]}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    maxLength={300}
                    label={t("report.note")}
                    autoCapitalize="sentences"
                    multiline
                    scrollEnabled={false}
                    textAlignVertical="top"
                    theme={{ colors: { primary: theme.colors.onSurface } }}
                  />
                )}
              />
              <Text style={[s.privacyInfo, { color: theme.colors.onSurfaceVariant }]}>
                {t("report.notePrivacyInfo")}
              </Text>
              {errors.reporterNote?.message && (
                <Text style={[s.bold, { color: theme.colors.error }]}>
                  {t(asTranslationKey(errors.reporterNote.message))}
                </Text>
              )}
            </View>
          </KeyboardAwareScrollView>

          <Button
            testID="report-submit"
            onPress={handleSubmit(onSubmit)}
            mode="contained"
            style={s.button}
            disabled={isPending}
          >
            {isPending ? t("common.sending") : t("common.send")}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const s = StyleSheet.create({
  modalContainerStyle: {
    height: height * 0.6,
    justifyContent: "flex-start",
    borderRadius: BORDER_RADIUS,
    padding: 15,
    gap: 5,
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
  button: {
    borderRadius: BORDER_RADIUS,
  },
});
