// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useAuth } from "@/components/auth/auth-provider";
import SignInPrompt from "@/components/auth/sign-in-prompt";
import BackButton from "@/components/back-button";
import SectionPanel from "@/components/section-panel";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { HikingEvent } from "@/data/types";
import { useEventMutations } from "@/hooks/events/useEventMutations";
import { useEventManageMutations, useEventParticipants } from "@/hooks/events/useEventManage";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { formatEventDate, formatTimeRange } from "@/utils/event-time";
import { formatDistanceKm } from "@/utils/format-distance";
import { guardedNavigate } from "@/utils/navigation";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import EventActionBar from "./event-action-bar";
import EventFactRow from "./event-fact-row";
import EventGate from "./event-gate";
import EventInviteModal from "./event-invite-modal";
import EventManageMenu from "./event-manage-menu";
import EventMap from "./event-map";
import { EventStackRoutes } from "./event-routes";
import EventShareButton from "./event-share-button";
import EventParticipantsPanel from "./event-participants-panel";
import EventVisibilityChip from "./event-visibility-chip";
import InvitationAnswerButtons from "./invitation-answer-buttons";

type Props = {
  routes: EventStackRoutes;
};

export default function EventDetailsScreen(props: Props) {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  if (!isAuthenticated) return <SignInPrompt message={t("events.signInToSee")} />;
  return <EventDetails {...props} />;
}

function EventDetails({ routes }: Props) {
  const theme = useTheme();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  return (
    <EventGate identifier={identifier}>
      {(event, { isRefetching, refetch }) => (
        <View style={[s.screen, { backgroundColor: theme.colors.background }]}>
          <LoadedEvent event={event} routes={routes} isRefetching={isRefetching} onRefresh={() => void refetch()} />
          <EventFooter event={event} />
        </View>
      )}
    </EventGate>
  );
}

type LoadedProps = Props & { event: HikingEvent; isRefetching: boolean; onRefresh: () => void };

function LoadedEvent({ event, routes, isRefetching, onRefresh }: LoadedProps) {
  const myNickName = useAtomValue(stigviddUserAtom).data?.nickName;
  const participants = useEventParticipants(event.identifier);
  const manage = useEventManageMutations(event.identifier);
  const [inviting, setInviting] = useState(false);

  const excluded = [
    ...(participants.data?.participants ?? []).map((p) => p.nickName),
    ...(participants.data?.invited ?? []).map((i) => i.nickName),
  ];

  return (
    <>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
      >
        <View style={s.topBar}>
          <BackButton />
          <View style={s.flex} />
          <EventShareButton event={event} />
          <EventManageMenu
            event={event}
            onEdit={() =>
              guardedNavigate(() =>
                router.navigate({ pathname: routes.edit, params: { identifier: event.identifier } }),
              )
            }
            onInvite={() => setInviting(true)}
            onCancel={() => manage.cancelMutation.mutate()}
            onDelete={() => manage.deleteMutation.mutateAsync()}
          />
        </View>
        <EventBody event={event} routes={routes} />
        {participants.data?.participants ? (
          <View style={s.participants}>
            <EventParticipantsPanel
              participants={participants.data}
              permissions={event.permissions}
              myNickName={myNickName}
              onSetRole={(participant, role) =>
                manage.setRoleMutation.mutate({ userIdentifier: participant.userIdentifier, role })
              }
              onRemove={(participant) => manage.removeMutation.mutate(participant.userIdentifier)}
              onRevoke={(invitee) => manage.revokeMutation.mutate(invitee.userIdentifier)}
            />
          </View>
        ) : null}
      </ScrollView>
      <EventInviteModal
        visible={inviting}
        onDismiss={() => setInviting(false)}
        onInvite={(nickNames) => manage.inviteMutation.mutate(nickNames, { onSuccess: () => setInviting(false) })}
        isPending={manage.inviteMutation.isPending}
        excludeNickNames={excluded}
        dropNickNames={manage.unknownNickNames}
      />
    </>
  );
}

function EventBody({ event, routes }: { event: HikingEvent } & Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isCancelled = event.status === "Cancelled";
  const place = event.meetingPointName ?? event.locationName;
  const trailIdentifier = event.trailIdentifier;
  const length = event.route?.lengthMeters == null ? undefined : formatDistanceKm(event.route.lengthMeters / 1000);

  const spots =
    event.maxParticipants == null
      ? t("events.participants", { count: event.participantCount })
      : t("events.spotsTaken", { count: event.participantCount, max: event.maxParticipants });
  const interest = [
    event.interestedCount > 0 ? t("events.interestedCount", { count: event.interestedCount }) : undefined,
    event.registrationDeadline
      ? t("events.registrationCloses", { date: formatEventDate(event.registrationDeadline, i18n.language) })
      : undefined,
  ].filter(Boolean);

  return (
    <View style={s.body}>
      {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={s.cover} contentFit="cover" /> : null}

      <View style={s.heading}>
        <EventVisibilityChip visibility={event.visibility} />
        <Text style={[s.title, { color: theme.colors.onBackground }]}>{event.title}</Text>
        {event.organizerNickName ? (
          <Text style={[s.organizer, { color: theme.colors.onSurfaceVariant }]}>
            {t("events.arrangedBy", { nickName: event.organizerNickName })}
          </Text>
        ) : null}
      </View>

      {isCancelled ? (
        <View testID="event-cancelled-banner" style={[s.banner, { backgroundColor: theme.colors.errorContainer }]}>
          <Text style={[s.bannerText, { color: theme.colors.onErrorContainer }]}>{t("events.cancelledBanner")}</Text>
        </View>
      ) : null}

      {event.hasPendingInvite && !isCancelled ? <InviteBanner identifier={event.identifier} /> : null}

      <SectionPanel>
        <EventFactRow
          icon="calendar-blank-outline"
          primary={formatEventDate(event.startsAt, i18n.language)}
          secondary={formatTimeRange(event.startsAt, event.endsAt, i18n.language)}
        />
        {place ? <EventFactRow icon="map-marker-outline" primary={place} /> : null}
        {event.trailName && trailIdentifier ? (
          <EventFactRow
            testID="event-trail-link"
            icon="sign-direction"
            primary={event.trailName}
            secondary={length}
            onPress={() =>
              guardedNavigate(() =>
                router.navigate({ pathname: routes.trail, params: { identifier: trailIdentifier } }),
              )
            }
          />
        ) : null}
        {!event.trailName && length ? (
          <EventFactRow icon="vector-polyline" primary={t("events.ownRoute")} secondary={length} />
        ) : null}
        <EventFactRow icon="account-group-outline" primary={spots} secondary={interest.join(" · ") || undefined} />
      </SectionPanel>

      <EventMap event={event} routes={routes} />

      <SectionPanel title={t("events.about")}>
        <Text style={[s.description, { color: theme.colors.onSurface }]}>{event.description}</Text>
      </SectionPanel>

      <SectionPanel>
        <EventFactRow
          testID="event-board-link"
          icon={event.permissions.canReadBoard ? "message-text-outline" : "lock-outline"}
          primary={t("events.board")}
          secondary={event.permissions.canReadBoard ? undefined : t("events.boardJoinToRead")}
          onPress={
            event.permissions.canReadBoard
              ? () =>
                  guardedNavigate(() =>
                    router.navigate({ pathname: routes.board, params: { identifier: event.identifier } }),
                  )
              : undefined
          }
        />
      </SectionPanel>
    </View>
  );
}

function InviteBanner({ identifier }: { identifier: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { acceptInvitationMutation, declineInvitationMutation } = useEventMutations();
  const busy = acceptInvitationMutation.isPending || declineInvitationMutation.isPending;

  return (
    <View testID="event-invite-banner" style={[s.banner, { backgroundColor: theme.colors.tertiaryContainer }]}>
      <Text style={[s.bannerText, { color: theme.colors.onTertiaryContainer }]}>{t("events.youAreInvited")}</Text>
      <InvitationAnswerButtons
        busy={busy}
        onAccept={() => acceptInvitationMutation.mutate(identifier)}
        onDecline={() => declineInvitationMutation.mutate(identifier)}
      />
    </View>
  );
}

function EventFooter({ event }: { event: HikingEvent }) {
  const { joinMutation, leaveMutation, interestedMutation } = useEventMutations();
  const busy = joinMutation.isPending || leaveMutation.isPending || interestedMutation.isPending;

  // An invitee answers in the banner instead. keep-comment: accepting is the invitee's join
  if (event.hasPendingInvite) return null;

  return (
    <EventActionBar
      event={event}
      busy={busy}
      onJoin={() => joinMutation.mutate(event.identifier)}
      onLeave={() => leaveMutation.mutate(event.identifier)}
      onInterested={(interested) => interestedMutation.mutate({ identifier: event.identifier, interested })}
    />
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 8,
  },
  flex: {
    flex: 1,
  },
  participants: {
    marginTop: 12,
  },
  body: {
    gap: 12,
  },
  cover: {
    height: 180,
    marginHorizontal: SCREEN_PADDING,
    borderRadius: BORDER_RADIUS,
  },
  heading: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 6,
  },
  title: {
    fontSize: 24,
    lineHeight: 29,
    fontFamily: "Inter_600SemiBold",
  },
  organizer: {
    fontSize: 14,
  },
  banner: {
    marginHorizontal: SCREEN_PADDING,
    padding: 12,
    borderRadius: BORDER_RADIUS,
    gap: 8,
  },
  bannerText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
  },
});
