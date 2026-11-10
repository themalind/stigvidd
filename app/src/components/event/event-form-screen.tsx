// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useAuth } from "@/components/auth/auth-provider";
import SignInPrompt from "@/components/auth/sign-in-prompt";
import CountedTextInput from "@/components/form/counted-text-input";
import FieldErrorBadge from "@/components/form/field-error-badge";
import DateTimeField from "@/components/form/date-time-field";
import PointPickerMap from "@/components/map/point-picker-map";
import CoverFramer from "@/components/media/cover-framer";
import SectionPanel from "@/components/layout/section-panel";
import { BORDER_RADIUS, EVENT_COVER_ASPECT, SCREEN_PADDING } from "@/constants/constants";
import { EVENT_REQUEST_LIMITS } from "@/constants/event-limits";
import { EventVisibility, HikingEvent } from "@/data/types";
import { CoverChange, useSaveEvent } from "@/hooks/events/useSaveEvent";
import {
  clampDeadline,
  EventFormErrors,
  EventFormValues,
  emptyEventForm,
  eventFormFromEvent,
  validateEventForm,
} from "@/utils/event-form";
import { formatDistanceKm } from "@/utils/format-distance";
import { guardedNavigate } from "@/utils/navigation";
import { pickImages } from "@/utils/pick-images";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button, Chip, Icon, IconButton, Switch, Text, TextInput, useTheme } from "react-native-paper";
import EventInviteModal from "./event-invite-modal";
import EventGate from "./event-gate";
import EventRoutePicker from "./event-route-picker";
import { EVENTS_TAB_ROUTES, leaveEventScreen } from "./event-routes";

export default function EventFormScreen() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const { identifier } = useLocalSearchParams<{ identifier?: string }>();

  if (!isAuthenticated) return <SignInPrompt message={t("events.signInToSee")} />;
  if (identifier) return <EventGate identifier={identifier}>{(event) => <EventForm original={event} />}</EventGate>;
  return <EventForm />;
}

function EventForm({ original }: { original?: HikingEvent }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [values, setValues] = useState<EventFormValues>(() =>
    original ? eventFormFromEvent(original) : emptyEventForm(),
  );
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [cover, setCover] = useState<CoverChange>(null);
  const [pickingRoute, setPickingRoute] = useState(false);
  const [pickingInvitees, setPickingInvitees] = useState(false);
  const save = useSaveEvent(original);

  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const isCreate = !original;
  const isPrivate = values.visibility === "Private";
  const canToggleInvites = !original || original.myRole === "Organizer";
  const savedCoverUri = cover === null ? (original?.imageUrl ?? null) : null;
  const [draggingCover, setDraggingCover] = useState(false);

  const chooseCover = async () => {
    const uris = await pickImages({ limit: 1 });
    if (uris && uris[0]) setCover({ uri: uris[0], focusY: 0.5 });
  };

  // Only a saved cover needs a delete; an unsaved pick is just dropped. keep-comment: avoids a needless DELETE on create
  const removeCover = () => setCover(original?.imageUrl ? "remove" : null);

  const submit = () => {
    const found = validateEventForm(values, new Date(), original);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(
      { values, cover },
      {
        // A new event opens in place of the form; an edit goes back. keep-comment: create lives only in the events tab
        onSuccess: (saved) => {
          if (original) leaveEventScreen();
          else
            guardedNavigate(() =>
              router.replace({
                pathname: EVENTS_TAB_ROUTES.detail,
                params: { identifier: saved.identifier },
              }),
            );
        },
      },
    );
  };

  const submitLabel = original
    ? t("common.save")
    : isPrivate && values.invitees.length > 0
      ? t("events.form.createAndInvite", { count: values.invitees.length })
      : t("events.form.create");

  const error = (key: keyof EventFormErrors) => (errors[key] ? t(errors[key]) : undefined);

  return (
    <KeyboardAvoidingView
      style={[s.screen, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.header}>
        <IconButton
          testID="event-form-close"
          icon="close"
          accessibilityLabel={t("common.close")}
          onPress={leaveEventScreen}
        />
        <Text style={[s.headerTitle, { color: theme.colors.onBackground }]}>
          {isCreate ? t("events.form.newTitle") : t("events.form.editTitle")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" scrollEnabled={!draggingCover}>
        <CoverPicker
          picked={cover !== null && cover !== "remove" ? cover : null}
          savedUri={savedCoverUri}
          onFocusChange={(focusY) =>
            setCover((current) => (current && current !== "remove" ? { ...current, focusY } : current))
          }
          onDragChange={setDraggingCover}
          onPick={() => void chooseCover()}
          onRemove={removeCover}
        />

        <SectionPanel title={t("events.form.about")}>
          <View style={s.fields}>
            <View>
              <CountedTextInput
                testID="event-form-title"
                mode="outlined"
                label={t("events.form.title")}
                value={values.title}
                onChangeText={(text) => set("title", text)}
                maxLength={EVENT_REQUEST_LIMITS.title}
                error={!!errors.title}
              />
              <FieldErrorBadge text={error("title")} />
            </View>
            <View>
              <CountedTextInput
                testID="event-form-description"
                mode="outlined"
                multiline
                label={t("events.form.description")}
                value={values.description}
                onChangeText={(text) => set("description", text)}
                maxLength={EVENT_REQUEST_LIMITS.description}
                style={s.description}
              />
              <FieldErrorBadge text={error("description")} />
            </View>
          </View>
        </SectionPanel>

        <SectionPanel title={t("events.form.when")}>
          <View style={s.fields}>
            <View style={s.pair}>
              <DateTimeField
                testID="event-form-starts"
                label={t("events.form.startsAt")}
                value={values.startsAt}
                onChange={(date) => set("startsAt", date)}
                minimumDate={new Date()}
                error={error("startsAt")}
              />
              <DateTimeField
                testID="event-form-ends"
                label={t("events.form.endsAt")}
                value={values.endsAt}
                onChange={(date) => set("endsAt", date)}
                minimumDate={values.startsAt ?? new Date()}
                clearable
                error={error("endsAt")}
              />
            </View>
            <DateTimeField
              testID="event-form-deadline"
              mode="date"
              label={t("events.form.deadline")}
              placeholder={t("events.form.chooseDate")}
              value={values.registrationDeadline}
              onChange={(date) => set("registrationDeadline", clampDeadline(date, values.startsAt))}
              minimumDate={new Date()}
              clearable
              error={error("registrationDeadline")}
            />
          </View>
        </SectionPanel>

        <SectionPanel title={t("events.form.where")}>
          <View style={s.fields}>
            <RouteRow
              values={values}
              onChoose={() => setPickingRoute(true)}
              onClear={() => set("route", { kind: "none" })}
            />
            <View style={s.fieldGap}>
              <Text style={[s.label, { color: theme.colors.onSurface }]}>{t("events.form.meetingPoint")}</Text>
              <PointPickerMap
                testID="event-form-meeting-map"
                value={values.meetingPoint}
                onChange={(position) => set("meetingPoint", position)}
                label={values.meetingPointName.trim() || t("events.meetingPoint")}
                hint={values.meetingPoint ? t("events.form.tapToMove") : t("events.form.tapToPlace")}
              />
              {values.meetingPoint ? (
                <View style={s.meetingRow}>
                  <TextInput
                    testID="event-form-meeting-name"
                    mode="outlined"
                    dense
                    style={s.flex}
                    placeholder={t("events.form.meetingPointName")}
                    accessibilityLabel={t("events.form.meetingPointName")}
                    value={values.meetingPointName}
                    onChangeText={(text) => set("meetingPointName", text)}
                    maxLength={EVENT_REQUEST_LIMITS.placeName}
                  />
                  <IconButton
                    testID="event-form-meeting-clear"
                    icon="close"
                    accessibilityLabel={t("events.form.removeMeetingPoint")}
                    onPress={() => set("meetingPoint", null)}
                  />
                </View>
              ) : null}
              <FieldErrorBadge text={error("meetingPointName") ?? error("place")} />
            </View>
          </View>
        </SectionPanel>

        <SectionPanel title={t("events.form.who")}>
          <View style={s.fields}>
            {isCreate ? (
              <VisibilityChoice value={values.visibility} onChange={(visibility) => set("visibility", visibility)} />
            ) : null}
            <View style={s.switchRow}>
              <View style={s.flex}>
                <Text style={{ color: theme.colors.onSurface }}>{t("events.form.maxParticipants")}</Text>
                <Text style={[s.help, { color: theme.colors.onSurfaceVariant }]}>
                  {t("events.form.maxParticipantsHelp")}
                </Text>
              </View>
              <TextInput
                testID="event-form-max"
                mode="outlined"
                dense
                keyboardType="number-pad"
                accessibilityLabel={t("events.form.maxParticipants")}
                value={values.maxParticipants}
                onChangeText={(text) => set("maxParticipants", text)}
                maxLength={3}
                error={!!errors.maxParticipants}
                style={s.number}
              />
            </View>
            <FieldErrorBadge text={error("maxParticipants")} />
            {canToggleInvites ? (
              <View style={s.switchRow}>
                <View style={s.flex}>
                  <Text style={{ color: theme.colors.onSurface }}>{t("events.form.allowInvites")}</Text>
                  <Text style={[s.help, { color: theme.colors.onSurfaceVariant }]}>
                    {t("events.form.allowInvitesHelp")}
                  </Text>
                </View>
                <Switch
                  testID="event-form-allow-invites"
                  value={values.allowParticipantInvites}
                  onValueChange={(on) => set("allowParticipantInvites", on)}
                />
              </View>
            ) : null}
          </View>
        </SectionPanel>

        {isCreate && isPrivate ? (
          <SectionPanel title={t("events.invite")}>
            <View style={s.fields}>
              {values.invitees.length > 0 ? (
                <View style={s.chips}>
                  {values.invitees.map((nickName) => (
                    <Chip
                      key={nickName}
                      testID={`event-form-invitee-${nickName}`}
                      onClose={() =>
                        set(
                          "invitees",
                          values.invitees.filter((n) => n !== nickName),
                        )
                      }
                      style={{ borderRadius: BORDER_RADIUS }}
                    >
                      {nickName}
                    </Chip>
                  ))}
                </View>
              ) : (
                <Text style={[s.help, { color: theme.colors.onSurfaceVariant }]}>{t("events.form.inviteHelp")}</Text>
              )}
              <Button
                testID="event-form-choose-invitees"
                mode="outlined"
                icon="account-plus-outline"
                onPress={() => setPickingInvitees(true)}
                style={{ borderRadius: BORDER_RADIUS }}
              >
                {t("events.form.chooseInvitees")}
              </Button>
            </View>
          </SectionPanel>
        ) : null}
      </ScrollView>

      <View style={[s.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
        <Button
          testID="event-form-submit"
          mode="contained"
          loading={save.isPending}
          disabled={save.isPending}
          onPress={submit}
          style={{ borderRadius: BORDER_RADIUS }}
          contentStyle={s.submit}
        >
          {submitLabel}
        </Button>
      </View>

      <EventRoutePicker
        visible={pickingRoute}
        onDismiss={() => setPickingRoute(false)}
        onPick={(route) => {
          set("route", route);
          setPickingRoute(false);
        }}
      />
      <EventInviteModal
        visible={pickingInvitees}
        onDismiss={() => setPickingInvitees(false)}
        onInvite={(nickNames) => {
          set("invitees", nickNames.slice(0, EVENT_REQUEST_LIMITS.invitesPerRequest));
          setPickingInvitees(false);
        }}
        initialSelected={values.invitees}
      />
    </KeyboardAvoidingView>
  );
}

type CoverPickerProps = {
  picked: { uri: string; focusY: number } | null;
  savedUri: string | null;
  onFocusChange: (focusY: number) => void;
  onDragChange: (dragging: boolean) => void;
  onPick: () => void;
  onRemove: () => void;
};

// A new pick can be reframed; a saved cover was cut when uploaded. keep-comment: why only a pick is draggable
function CoverPicker({ picked, savedUri, onFocusChange, onDragChange, onPick, onRemove }: CoverPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const actions = (
    <View style={s.coverActions}>
      <Button
        testID="event-form-cover-change"
        mode="contained-tonal"
        compact
        onPress={onPick}
        style={{ borderRadius: BORDER_RADIUS }}
      >
        {t("events.form.changeCover")}
      </Button>
      <Button
        testID="event-form-cover-remove"
        mode="contained-tonal"
        compact
        onPress={onRemove}
        style={{ borderRadius: BORDER_RADIUS }}
      >
        {t("common.delete")}
      </Button>
    </View>
  );

  if (picked)
    return (
      <CoverFramer
        testID="event-form-cover"
        uri={picked.uri}
        aspect={EVENT_COVER_ASPECT}
        focusY={picked.focusY}
        onFocusChange={onFocusChange}
        onDragChange={onDragChange}
        style={s.coverSpacing}
      >
        {actions}
      </CoverFramer>
    );

  if (savedUri)
    return (
      <View testID="event-form-cover" style={[s.cover, s.coverSpacing]}>
        <Image source={{ uri: savedUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {actions}
      </View>
    );

  return (
    <Pressable
      testID="event-form-cover-add"
      accessibilityRole="button"
      onPress={onPick}
      style={[
        s.cover,
        s.coverSpacing,
        s.coverEmpty,
        { borderColor: theme.colors.outline, backgroundColor: theme.colors.surface },
      ]}
    >
      <Icon source="image-outline" size={28} color={theme.colors.onSurfaceVariant} />
      <Text style={{ color: theme.colors.onSurfaceVariant }}>{t("events.form.addCover")}</Text>
    </Pressable>
  );
}

function RouteRow({
  values,
  onChoose,
  onClear,
}: {
  values: EventFormValues;
  onChoose: () => void;
  onClear: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const route = values.route;

  if (route.kind === "none")
    return (
      <View style={s.fieldGap}>
        <Text style={[s.label, { color: theme.colors.onSurface }]}>{t("events.form.route")}</Text>
        <Button
          testID="event-form-choose-route"
          mode="outlined"
          icon="map-marker-path"
          onPress={onChoose}
          style={{ borderRadius: BORDER_RADIUS }}
        >
          {t("events.form.chooseRoute")}
        </Button>
      </View>
    );

  const name = route.kind === "kept" ? t("events.ownRoute") : route.name;
  const length = route.lengthMeters ? formatDistanceKm(route.lengthMeters / 1000) : undefined;
  const icon = route.kind === "trail" ? "sign-direction" : "vector-polyline";

  return (
    <View style={s.fieldGap}>
      <Text style={[s.label, { color: theme.colors.onSurface }]}>{t("events.form.route")}</Text>
      <View testID="event-form-route" style={[s.routeCard, { backgroundColor: theme.colors.primaryContainer }]}>
        <Icon source={icon} size={20} color={theme.colors.onPrimaryContainer} />
        <Pressable
          style={s.flex}
          onPress={onChoose}
          accessibilityRole="button"
          accessibilityLabel={t("events.form.changeRoute")}
        >
          <Text style={[s.routeName, { color: theme.colors.onPrimaryContainer }]} numberOfLines={1}>
            {name}
          </Text>
          {length ? <Text style={{ color: theme.colors.onPrimaryContainer, fontSize: 12 }}>{length}</Text> : null}
        </Pressable>
        <IconButton
          testID="event-form-route-clear"
          icon="close"
          size={18}
          iconColor={theme.colors.onPrimaryContainer}
          accessibilityLabel={t("events.form.removeRoute")}
          onPress={onClear}
        />
      </View>
    </View>
  );
}

function VisibilityChoice({ value, onChange }: { value: EventVisibility; onChange: (value: EventVisibility) => void }) {
  const { t } = useTranslation();
  return (
    <View accessibilityRole="radiogroup" style={s.pair}>
      <VisibilityOption
        testID="event-form-open"
        selected={value === "Open"}
        icon="earth"
        title={t("events.open")}
        help={t("events.form.openHelp")}
        onPress={() => onChange("Open")}
      />
      <VisibilityOption
        testID="event-form-private"
        selected={value === "Private"}
        icon="lock-outline"
        title={t("events.private")}
        help={t("events.form.privateHelp")}
        onPress={() => onChange("Private")}
      />
    </View>
  );
}

type OptionProps = {
  testID: string;
  selected: boolean;
  icon: string;
  title: string;
  help: string;
  onPress: () => void;
};

function VisibilityOption({ testID, selected, icon, title, help, onPress }: OptionProps) {
  const theme = useTheme();
  const color = selected ? theme.colors.onSecondaryContainer : theme.colors.onSurface;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        s.option,
        selected
          ? { borderColor: theme.colors.primary, borderWidth: 2, backgroundColor: theme.colors.secondaryContainer }
          : { borderColor: theme.colors.outline, borderWidth: 1 },
      ]}
    >
      <View style={s.optionTitle}>
        <Icon source={icon} size={16} color={color} />
        <Text style={[s.optionText, { color }]}>{title}</Text>
      </View>
      <Text style={[s.help, { color: selected ? color : theme.colors.onSurfaceVariant }]}>{help}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: SCREEN_PADDING,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    gap: 12,
    paddingBottom: 24,
  },
  fields: {
    gap: 12,
  },
  fieldGap: {
    gap: 4,
  },
  pair: {
    flexDirection: "row",
    gap: 8,
  },
  label: {
    fontSize: 13,
  },
  help: {
    fontSize: 12,
  },
  description: {
    minHeight: 100,
  },
  flex: {
    flex: 1,
  },
  meetingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  number: {
    width: 72,
    textAlign: "center",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cover: {
    aspectRatio: EVENT_COVER_ASPECT,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  coverSpacing: {
    marginHorizontal: SCREEN_PADDING,
  },
  coverEmpty: {
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  coverActions: {
    position: "absolute",
    right: 8,
    top: 8,
    flexDirection: "row",
    gap: 8,
  },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 10,
    borderRadius: BORDER_RADIUS,
  },
  routeName: {
    fontFamily: "Inter_600SemiBold",
  },
  option: {
    flex: 1,
    padding: 10,
    borderRadius: BORDER_RADIUS,
    gap: 4,
  },
  optionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  optionText: {
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submit: {
    height: 48,
  },
});
