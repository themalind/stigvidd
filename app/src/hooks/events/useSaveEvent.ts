// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { createEvent, deleteEventImage, inviteToEvent, setEventImage, updateEvent } from "@/api/events";
import { showSuccessAtom, showWarningAtom } from "@/atoms/snackbar-atoms";
import { HikingEvent } from "@/data/types";
import { EventFormValues, toCreateEventRequest, toUpdateEventRequest } from "@/utils/event-form";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { useEventErrorHandler } from "./useEventErrorHandler";

// A picked file to upload, "remove" to drop the current one, or null to leave it. keep-comment: the three image outcomes
export type CoverChange = { uri: string } | "remove" | null;

type SaveInput = { values: EventFormValues; cover: CoverChange };

async function applyCover(identifier: string, cover: CoverChange): Promise<boolean> {
  try {
    if (cover === "remove") await deleteEventImage(identifier);
    else if (cover) await setEventImage(identifier, cover.uri);
    return true;
  } catch {
    return false;
  }
}

export function useSaveEvent(original?: HikingEvent) {
  const { t } = useTranslation();
  const { refresh, onEventError } = useEventErrorHandler();
  const setSuccess = useSetAtom(showSuccessAtom);
  const setWarning = useSetAtom(showWarningAtom);

  return useMutation({
    mutationFn: async ({ values, cover }: SaveInput): Promise<HikingEvent> => {
      const saved = original
        ? await updateEvent(original.identifier, toUpdateEventRequest(values, original))
        : await createEvent(toCreateEventRequest(values));
      const invites = !original && values.visibility === "Private" && values.invitees.length > 0;

      // The event exists by now, so a failed cover or invite only warns. keep-comment: why these do not reject
      const [imageOk, invitesOk] = await Promise.all([
        applyCover(saved.identifier, cover),
        invites
          ? inviteToEvent(saved.identifier, values.invitees).then(
              () => true,
              () => false,
            )
          : true,
      ]);

      if (!imageOk) setWarning(t("events.form.imageFailed"));
      else if (!invitesOk) setWarning(t("events.form.invitesFailed"));
      else setSuccess(t(original ? "events.form.saved" : "events.form.created"));
      return saved;
    },
    onSuccess: refresh,
    onError: (error) => onEventError(error),
  });
}
