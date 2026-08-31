// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { logger, setLogSink, startLogLifecycle, LogRecord } from "./logger";

/**
 * Telemetry bootstrap: one call, safe to make unconditionally.
 *
 * Every piece inside no-ops when its `EXPO_PUBLIC_OO_*` variables are absent, so local
 * development, Jest and CI are unaffected — nothing is buffered and no network call is made.
 *
 * Called at module scope from app/_layout.tsx rather than in an effect, because RootLayout
 * returns null until fonts and the session have resolved; an effect would miss startup errors
 * entirely, which are exactly the ones worth having.
 */

const LOGS_URL = process.env.EXPO_PUBLIC_OO_LOGS_URL;
const LOGS_TOKEN = process.env.EXPO_PUBLIC_OO_LOGS_TOKEN;

// Deliberately shorter than the logger's SINK_TIMEOUT_MS watchdog, so a stalled request is
// normally cancelled here — where the socket can actually be released — and the watchdog stays
// a backstop for a sink that misbehaves in some other way.
const REQUEST_TIMEOUT_MS = 15_000;

let initialised = false;

/**
 * Ships batches to OpenObserve's bulk JSON ingest: POST /api/<org>/<stream>/_json with a JSON
 * array body.
 *
 * NOTE ON THE CREDENTIAL: anything in an EXPO_PUBLIC_* var is inlined into the JS bundle by
 * Metro and is trivially extractable from an installed APK or IPA. So the value here MUST be
 * an INGESTION TOKEN — base64 of "user:passcode", copied from OpenObserve's Ingestion page —
 * and never base64 of a login PASSWORD, which is what this used to say.
 *
 * The distinction is the whole security model, because OpenObserve OSS has no RBAC: every
 * account is an admin, and the passcode is the only thing that scopes a credential to
 * ingest. Measured against v0.92.2 with the same account: the passcode ingests (200) but
 * answers 401 on /_search and /users, while the password reads every stream and creates
 * further admin users. A password in this file would therefore hand full control of the
 * observatory to anyone who unzips the APK. See docs/notes/openobserve-oss-has-no-rbac.md.
 *
 * Treat it as public and rotatable regardless: rotating means a new app build and release,
 * so it is worth getting right the first time.
 */
function createHttpSink(url: string, token: string) {
  return async (records: LogRecord[]) => {
    // React Native's fetch has no default timeout, so a stalled connection — a captive portal,
    // or dead-air TCP on a patchy mobile network — would otherwise hold this request open
    // indefinitely and, through the logger's `flushing` guard, stop log shipping for good.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${token}`,
        },
        body: JSON.stringify(
          // Context is spread FIRST so a context key named `level`, `message` or `_timestamp`
          // cannot shadow the record's own fields. Call sites use `errorMessage` for exactly
          // this reason, but nothing enforces that at the type level.
          records.map((record) => ({
            ...record.context,
            _timestamp: new Date(record.timestamp).getTime() * 1000, // OpenObserve wants microseconds
            level: record.level,
            message: record.message,
          })),
        ),
      });

      if (!response.ok) {
        throw new Error(`log shipping failed: HTTP ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  };
}

/**
 * Installs the global JS error and unhandled-rejection handlers.
 *
 * Both CHAIN rather than replace: whatever handler is already installed (React Native's red
 * box, and the RUM SDK's own once it is added) still runs after ours. Replacing them would
 * silently disable crash reporting to gain logging, which is a bad trade.
 */
function installGlobalErrorHandlers(): void {
  const previousHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    logger.error("Unhandled JS error", {
      name: error?.name,
      errorMessage: error?.message,
      stack: error?.stack,
      isFatal,
    });

    previousHandler?.(error, isFatal);
  });

  // Promise rejections never reach ErrorUtils. React Native bundles a tracker for exactly
  // this; there are no types for it, hence the require.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rejectionTracking = require("promise/setimmediate/rejection-tracking");

  rejectionTracking.enable({
    allRejections: true,
    onUnhandled: (id: number, error: unknown) => {
      const rejection = error instanceof Error ? error : new Error(String(error));

      logger.error("Unhandled promise rejection", {
        rejectionId: id,
        errorMessage: rejection.message,
        stack: rejection.stack,
      });
    },
    onHandled: () => {
      // A rejection handled late is not an incident — deliberately silent.
    },
  });
}

export function initTelemetry(): void {
  if (initialised) return;

  initialised = true;

  if (LOGS_URL && LOGS_TOKEN) {
    setLogSink(createHttpSink(LOGS_URL, LOGS_TOKEN));
    startLogLifecycle();
  }

  installGlobalErrorHandlers();
}
