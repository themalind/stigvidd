// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_OIDC_URL: string;
  readonly VITE_OIDC_REALM: string;
  readonly VITE_CLIENT_ID: string;
  // Telemetry is opt-in, so both are optional: a build with neither set installs no sink.
  // VITE_OO_LOGS_TOKEN is an OpenObserve INGESTION TOKEN (base64 of "user:passcode"), never
  // a login password — it is inlined into the public bundle. See services/telemetry.ts.
  readonly VITE_OO_LOGS_URL?: string;
  readonly VITE_OO_LOGS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
