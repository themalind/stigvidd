// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Type-safety for translation keys.
// Augments i18next so `t("...")` keys are autocompleted and checked at compile
// time against sv.json (the source-of-truth locale). A typo or missing key
// becomes a TypeScript error instead of a silent runtime miss.
import "i18next";
import sv from "../i18n/locales/sv.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof sv;
    };
  }
}
