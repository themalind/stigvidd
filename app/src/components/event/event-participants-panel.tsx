// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AlertDialog from "@/components/dialog/alert-dialog";
import EventRoleChip from "@/components/event/event-role-chip";
import OverflowMenu from "@/components/layout/overflow-menu";
import SectionPanel from "@/components/layout/section-panel";
import { EventInvitee, EventParticipant, EventParticipants, EventPermissions } from "@/data/types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Button, IconButton, Text, useTheme } from "react-native-paper";

// The API sends every participant (at most 500), so the list grows here rather than paging the request. keep-comment: why paging is client-side
export const PARTICIPANTS_PAGE = 10;

type Props = {
  participants: EventParticipants;
  permissions: EventPermissions;
  myNickName: string | undefined;
  onSetRole: (participant: EventParticipant, role: "CoHost" | "Participant") => void;
  onRemove: (participant: EventParticipant) => void;
  onRevoke: (invitee: EventInvitee) => void;
};

export default function EventParticipantsPanel({
  participants,
  permissions,
  myNickName,
  onSetRole,
  onRemove,
  onRevoke,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [toRemove, setToRemove] = useState<EventParticipant | null>(null);
  const [shown, setShown] = useState(PARTICIPANTS_PAGE);
  const list = participants.participants ?? [];
  const hiddenCount = Math.max(0, list.length - shown);
  const invited = participants.invited ?? [];
  const canChangeRole = (participant: EventParticipant) =>
    permissions.canChangeRoles && participant.role !== "Organizer";
  const canRemove = (participant: EventParticipant) =>
    permissions.canRemoveParticipants && participant.role !== "Organizer" && participant.nickName !== myNickName;
  // The API lets hosts revoke any invitation and others only their own; canPinOrDeletePosts is the host check. keep-comment: mirrors CanRevokeInvitation
  const canRevoke = (invitee: EventInvitee) =>
    permissions.canPinOrDeletePosts || (myNickName !== undefined && invitee.invitedByNickName === myNickName);

  return (
    <SectionPanel
      title={t("events.participantsTitle", { count: participants.participantCount })}
      testID="event-participants"
    >
      {list.slice(0, shown).map((participant) => (
        <ParticipantRow
          key={participant.userIdentifier}
          participant={participant}
          canChangeRole={canChangeRole(participant)}
          canRemove={canRemove(participant)}
          onSetRole={onSetRole}
          onRemove={setToRemove}
        />
      ))}
      {hiddenCount > 0 ? (
        <Button
          testID="event-participants-more"
          mode="text"
          compact
          onPress={() => setShown((count) => count + PARTICIPANTS_PAGE)}
          style={s.more}
        >
          {t("events.showMoreParticipants", { count: hiddenCount })}
        </Button>
      ) : null}

      {invited.length > 0 ? (
        <View style={s.invited}>
          <Text style={[s.subheading, { color: theme.colors.onSurfaceVariant }]}>{t("events.invitedTitle")}</Text>
          {invited.map((invitee) => (
            <View key={invitee.userIdentifier} testID={`event-invitee-${invitee.nickName}`} style={s.row}>
              <Text style={[s.name, { color: theme.colors.onSurface }]}>{invitee.nickName}</Text>
              {canRevoke(invitee) ? (
                <IconButton
                  icon="close"
                  size={18}
                  accessibilityLabel={t("events.revokeInvitation", { nickName: invitee.nickName })}
                  onPress={() => onRevoke(invitee)}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <AlertDialog
        testID="event-remove-participant-dialog"
        visible={toRemove !== null}
        onDismiss={() => setToRemove(null)}
        title={t("events.removeParticipantTitle", { nickName: toRemove?.nickName ?? "" })}
        icon="account-remove-outline"
        tone="danger"
        infoText={[t("events.removeParticipantBody")]}
        confirmText={t("events.removeParticipant")}
        cancelText={t("common.cancel")}
        onConfirm={() => {
          if (toRemove) onRemove(toRemove);
          setToRemove(null);
        }}
      />
    </SectionPanel>
  );
}

type RowProps = {
  participant: EventParticipant;
  canChangeRole: boolean;
  canRemove: boolean;
  onSetRole: (participant: EventParticipant, role: "CoHost" | "Participant") => void;
  onRemove: (participant: EventParticipant) => void;
};

function ParticipantRow({ participant, canChangeRole, canRemove, onSetRole, onRemove }: RowProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View testID={`event-participant-${participant.nickName}`} style={s.row}>
      <View style={s.identity}>
        <Text style={[s.name, { color: theme.colors.onSurface }]}>{participant.nickName}</Text>
        <EventRoleChip role={participant.role} testID={`event-participant-role-${participant.nickName}`} />
      </View>
      <OverflowMenu
        testID={`event-participant-menu-${participant.nickName}`}
        size={18}
        accessibilityLabel={t("events.participantActions", { nickName: participant.nickName })}
        items={[
          {
            icon: "account-star-outline",
            title: t("events.makeCoHost"),
            onPress: () => onSetRole(participant, "CoHost"),
            visible: canChangeRole && participant.role === "Participant",
          },
          {
            icon: "account-outline",
            title: t("events.makeParticipant"),
            onPress: () => onSetRole(participant, "Participant"),
            visible: canChangeRole && participant.role === "CoHost",
          },
          {
            icon: "account-remove-outline",
            title: t("events.removeParticipant"),
            onPress: () => onRemove(participant),
            visible: canRemove,
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 40,
  },
  identity: {
    flex: 1,
    gap: 3,
    paddingVertical: 4,
  },
  name: {
    fontSize: 14,
  },
  invited: {
    gap: 2,
  },
  more: {
    alignSelf: "flex-start",
  },
  subheading: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
