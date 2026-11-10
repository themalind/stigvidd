// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Tag from "@/components/display/tag";
import { EventParticipant } from "@/data/types";
import { useTranslation } from "react-i18next";

type Props = {
  role: EventParticipant["role"];
  testID?: string;
};

export default function EventRoleChip({ role, testID }: Props) {
  const { t } = useTranslation();

  if (role !== "Organizer" && role !== "CoHost") return null;

  return <Tag testID={testID} label={role === "Organizer" ? t("events.roleOrganizer") : t("events.roleCoHost")} />;
}
