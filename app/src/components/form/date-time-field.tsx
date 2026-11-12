// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import FieldErrorBadge from "@/components/form/field-error-badge";
import { BORDER_RADIUS } from "@/constants/constants";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, IconButton, Text, useTheme } from "react-native-paper";
import { DatePickerModal, TimePickerModal } from "react-native-paper-dates";
import { paperDatesLocale } from "@/utils/format/paper-dates-locale";

type Props = {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  // "date" keeps the time of day already in the value. keep-comment: a deadline only needs a day
  mode?: "datetime" | "date";
  placeholder?: string;
  clearable?: boolean;
  minimumDate?: Date;
  error?: string;
  testID: string;
};

export function formatFieldValue(value: Date, mode: "datetime" | "date", language: string): string {
  const day = value.toLocaleDateString(language, { weekday: "short", day: "numeric", month: "short" });
  if (mode === "date") return day;
  return `${day} · ${value.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export default function DateTimeField({
  label,
  value,
  onChange,
  mode = "datetime",
  placeholder,
  clearable = false,
  minimumDate,
  error,
  testID,
}: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const locale = paperDatesLocale(i18n.language);
  const [step, setStep] = useState<"date" | "time" | null>(null);
  const [day, setDay] = useState<Date | null>(null);

  const pickDay = (picked: Date | undefined) => {
    if (!picked) {
      setStep(null);
      return;
    }
    if (mode === "date") {
      const kept = value ?? new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), 12, 0);
      onChange(new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), kept.getHours(), kept.getMinutes()));
      setStep(null);
      return;
    }
    setDay(picked);
    setStep("time");
  };

  const pickTime = ({ hours, minutes }: { hours: number; minutes: number }) => {
    const base = day ?? value ?? new Date();
    onChange(new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes));
    setStep(null);
  };

  const borderColor = error ? theme.colors.error : theme.colors.outline;

  return (
    <View style={s.field}>
      <Text style={[s.label, { color: theme.colors.onSurface }]}>{label}</Text>
      <View style={s.row}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => setStep("date")}
          style={[s.button, { borderColor, backgroundColor: theme.colors.surfaceVariant }]}
        >
          <Icon source="calendar-blank-outline" size={18} color={theme.colors.onSurfaceVariant} />
          <Text
            style={[s.value, { color: value ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {value ? formatFieldValue(value, mode, i18n.language) : (placeholder ?? t("common.select"))}
          </Text>
        </Pressable>
        {clearable && value ? (
          <IconButton
            testID={`${testID}-clear`}
            icon="close"
            size={18}
            accessibilityLabel={t("events.form.clear", { field: label })}
            onPress={() => onChange(null)}
          />
        ) : null}
      </View>
      <FieldErrorBadge text={error} />

      <DatePickerModal
        locale={locale}
        mode="single"
        visible={step === "date"}
        date={value ?? undefined}
        validRange={minimumDate ? { startDate: startOfDay(minimumDate) } : undefined}
        onDismiss={() => setStep(null)}
        onConfirm={({ date }) => pickDay(date)}
        label={label}
        saveLabel={mode === "date" ? t("common.done") : t("common.next")}
      />
      <TimePickerModal
        locale={locale}
        visible={step === "time"}
        hours={value?.getHours() ?? 10}
        minutes={value?.getMinutes() ?? 0}
        use24HourClock
        onDismiss={() => setStep(null)}
        onConfirm={pickTime}
        label={label}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("common.done")}
      />
    </View>
  );
}

const s = StyleSheet.create({
  field: {
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  // keep-comment: without flexShrink a long date runs out of the button instead of truncating
  value: {
    flexShrink: 1,
  },
  label: {
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS,
  },
});
