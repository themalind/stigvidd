// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Tag from "@/components/display/tag";
import { EventVisibility } from "@/data/types";
import { useTranslation } from "react-i18next";

type Props = {
  visibility: EventVisibility;
};

export default function EventVisibilityChip({ visibility }: Props) {
  const { t } = useTranslation();
  const isOpen = visibility === "Open";

  return (
    <Tag
      tone={isOpen ? "primary" : "secondary"}
      icon={isOpen ? "earth" : "lock-outline"}
      label={isOpen ? t("events.open") : t("events.private")}
    />
  );
}
