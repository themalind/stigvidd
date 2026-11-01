// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AlertDialog from "@/components/alert-dialog";
import OverflowMenu from "@/components/overflow-menu";
import SectionPanel from "@/components/section-panel";
import { EventInvitee, EventParticipant, EventParticipants, EventPermissions } from "@/data/types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

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
  const list = participants.participants ?? [];
  const invited = participants.invited ?? [];

  return (
    <SectionPanel
      title={t("events.participantsTitle", { count: participants.participantCount })}
      testID="event-participants"
    >
      {list.map((participant) => (
        <ParticipantRow
          key={participant.userIdentifier}
          participant={participant}
          canChangeRole={permissions.canChangeRoles && participant.role !== "Organizer"}
          canRemove={
            permissions.canRemoveParticipants && participant.role !== "Organizer" && participant.nickName !== myNickName
          }
          onSetRole={onSetRole}
          onRemove={setToRemove}
        />
      ))}

      {invited.length > 0 ? (
        <View style={s.invited}>
          <Text style={[s.subheading, { color: theme.colors.onSurfaceVariant }]}>{t("events.invitedTitle")}</Text>
          {invited.map((invitee) => (
            <View key={invitee.userIdentifier} testID={`event-invitee-${invitee.nickName}`} style={s.row}>
              <Text style={[s.name, { color: theme.colors.onSurface }]}>{invitee.nickName}</Text>
              {permissions.canInvite ? (
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
        irreversible
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
  const roleLabel =
    participant.role === "Organizer"
      ? t("events.roleOrganizer")
      : participant.role === "CoHost"
        ? t("events.roleCoHost")
        : undefined;

  return (
    <View testID={`event-participant-${participant.nickName}`} style={s.row}>
      <Text style={[s.name, { color: theme.colors.onSurface }]}>{participant.nickName}</Text>
      {roleLabel ? <Text style={[s.role, { color: theme.colors.primary }]}>{roleLabel}</Text> : null}
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
  name: {
    flex: 1,
    fontSize: 14,
  },
  role: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  invited: {
    gap: 2,
  },
  subheading: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
