// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { en, registerTranslation, sv } from "react-native-paper-dates";

registerTranslation("sv", sv);
registerTranslation("en", en);

// The picker locale for the app language; importing this module registers both. keep-comment: why it is a side-effect import
export function paperDatesLocale(language: string): "sv" | "en" {
  return language.startsWith("sv") ? "sv" : "en";
}
