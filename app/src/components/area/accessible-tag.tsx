// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Tag from "@/components/display/tag";
import { FACILITY_ICONS } from "@/constants/facility-icons";
import { useTranslation } from "react-i18next";

interface AccessibleTagProps {
  testID: string;
  // keep-comment: set on a counted row ("2 tillgängliga"); left out on a single place ("Tillgänglig")
  count?: number;
}

export default function AccessibleTag({ testID, count }: AccessibleTagProps) {
  const { t } = useTranslation();
  return (
    <Tag
      testID={testID}
      label={count === undefined ? t("area.accessibleBadge") : t("area.accessibleCount", { count })}
      tone="secondary"
      icon={FACILITY_ICONS.accessible}
    />
  );
}
