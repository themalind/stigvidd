// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import i18n, { asTranslationKey } from "@/i18n";

export default function issueTypeParser(issueType: string): string {
  const key = `obstacle.types.${issueType}`;
  const translated = i18n.t(asTranslationKey(key));
  return translated !== key ? translated : i18n.t("obstacle.types.Other");
}
