// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AlertDialog from "@/components/dialog/alert-dialog";
import OverflowMenu from "@/components/layout/overflow-menu";
import ReportContentForm from "@/components/report/report-content-form";
import { HikingEvent } from "@/data/types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { leaveEventScreen } from "./event-routes";

type Props = {
  event: HikingEvent;
  onEdit: () => void;
  onInvite: () => void;
  onCancel: () => void;
  onDelete: () => Promise<unknown>;
};

type Dialog = "cancel" | "delete" | "reportEvent" | "reportImage" | null;

// What the viewer may do from the menu; hosts never report their own event. keep-comment: a report hides it from them too
export function manageMenuItems(event: HikingEvent) {
  const isHost = event.myRole === "Organizer" || event.myRole === "CoHost";
  const live = event.status === "Published" && !event.isPast;
  return {
    edit: event.permissions.canEdit && live,
    invite: event.permissions.canInvite && live,
    cancel: event.permissions.canCancel,
    delete: event.permissions.canDelete,
    reportEvent: !isHost,
    reportImage: !isHost && !!event.imageIdentifier,
  };
}

export default function EventManageMenu({ event, onEdit, onInvite, onCancel, onDelete }: Props) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<Dialog>(null);
  const items = manageMenuItems(event);

  if (!Object.values(items).some(Boolean)) return null;

  return (
    <>
      <OverflowMenu
        testID="event-manage-menu"
        accessibilityLabel={t("events.moreActions")}
        items={[
          { icon: "pencil-outline", title: t("events.editEvent"), onPress: onEdit, visible: items.edit },
          { icon: "account-plus-outline", title: t("events.invite"), onPress: onInvite, visible: items.invite },
          {
            icon: "calendar-remove-outline",
            title: t("events.cancelEvent"),
            onPress: () => setDialog("cancel"),
            visible: items.cancel,
          },
          {
            icon: "delete-outline",
            title: t("events.deleteEvent"),
            onPress: () => setDialog("delete"),
            visible: items.delete,
          },
          {
            icon: "flag-outline",
            title: t("events.reportEvent"),
            onPress: () => setDialog("reportEvent"),
            visible: items.reportEvent,
          },
          {
            icon: "image-off-outline",
            title: t("events.reportImage"),
            onPress: () => setDialog("reportImage"),
            visible: items.reportImage,
          },
        ]}
      />

      <AlertDialog
        testID="event-cancel-dialog"
        visible={dialog === "cancel"}
        onDismiss={() => setDialog(null)}
        title={t("events.cancelEventTitle")}
        icon="calendar-remove-outline"
        tone="danger"
        irreversible
        infoText={[t("events.cancelEventBody")]}
        confirmText={t("events.cancelEvent")}
        cancelText={t("common.cancel")}
        onConfirm={() => {
          setDialog(null);
          onCancel();
        }}
      />

      <AlertDialog
        testID="event-delete-dialog"
        visible={dialog === "delete"}
        onDismiss={() => setDialog(null)}
        title={t("events.deleteEventTitle")}
        icon="delete-outline"
        tone="danger"
        irreversible
        infoText={[t("events.deleteEventBody")]}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        onConfirm={() => {
          setDialog(null);
          // A failed delete is already reported by the mutation. keep-comment: why the rejection is swallowed here
          void onDelete().then(leaveEventScreen, () => undefined);
        }}
      />

      {dialog === "reportEvent" ? (
        <ReportContentForm
          contentType="Event"
          contentIdentifier={event.identifier}
          invalidateQueryKey={["events"]}
          visible
          onDismiss={() => setDialog(null)}
        />
      ) : null}
      {dialog === "reportImage" && event.imageIdentifier ? (
        <ReportContentForm
          contentType="EventImage"
          contentIdentifier={event.imageIdentifier}
          invalidateQueryKey={["events"]}
          visible
          onDismiss={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
