// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import i18n from "@/i18n";

export function classificationParser(classificationNumber: number): string {
  switch (classificationNumber) {
    case 0:
      return i18n.t("trail.classification.notClassified");
    case 1:
      return i18n.t("trail.classification.easy");
    case 2:
      return i18n.t("trail.classification.medium");
    case 3:
      return i18n.t("trail.classification.hard");
    default:
      return i18n.t("trail.classification.notClassified");
  }
}
