// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Imported before keycloak-auth, which reads these when it loads. keep-comment: import order matters
process.env.EXPO_PUBLIC_OIDC_URL = "https://kc.test/auth";
process.env.EXPO_PUBLIC_OIDC_REALM = "stigvidd";
process.env.EXPO_PUBLIC_CLIENT_ID = "stigvidd-app";
