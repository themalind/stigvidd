// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { HikingEvent } from "@/data/types";
import { shareLinkUrl, shareMessage } from "@/utils/share-link";
import { useTranslation } from "react-i18next";
import { IconButton } from "react-native-paper";

// The link page serves open, upcoming events only. keep-comment: a private or past event's link would land on "not found"
function canShareEvent(event: HikingEvent) {
  return event.visibility === "Open" && event.status === "Published" && !event.isPast;
}

export default function EventShareButton({ event }: { event: HikingEvent }) {
  const { t } = useTranslation();
  if (!canShareEvent(event)) return null;

  const share = () =>
    shareMessage(
      t("events.shareMessage", { title: event.title, url: shareLinkUrl("event", event.identifier) }),
      "event",
    );

  return (
    <IconButton testID="event-share" icon="share-variant" accessibilityLabel={t("events.share")} onPress={share} />
  );
}
