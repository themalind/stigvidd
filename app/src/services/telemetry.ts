// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { logger, setLogSink, startLogLifecycle, LogRecord } from "./logger";
import { setEventSink } from "./analytics";
import { getAppInfo } from "./app-info";
import { loadConsent } from "./consent";

// keep-comment: no-ops without the EXPO_PUBLIC_OO_* variables, so dev, Jest and CI send nothing
// keep-comment: called at module scope in app/_layout.tsx, since an effect would miss startup errors

const LOGS_URL = process.env.EXPO_PUBLIC_OO_LOGS_URL;
const LOGS_TOKEN = process.env.EXPO_PUBLIC_OO_LOGS_TOKEN;

// keep-comment: its own stream, OpenObserve's only erasure unit; reuses LOGS_TOKEN, public in the bundle anyway
const EVENTS_URL = process.env.EXPO_PUBLIC_OO_EVENTS_URL;

// keep-comment: shorter than the logger's SINK_TIMEOUT_MS, so the socket is released here and the watchdog is a backstop
const REQUEST_TIMEOUT_MS = 15_000;

let initialised = false;

// keep-comment: the token is in the bundle, so it MUST be an ingestion token (base64 user:passcode), never a password:
// keep-comment: OpenObserve OSS has no RBAC and a password reads every stream (docs/notes/openobserve-oss-has-no-rbac.md)
function createHttpSink(url: string, token: string) {
  const appInfo = getAppInfo();

  return async (records: LogRecord[]) => {
    // keep-comment: RN fetch has no timeout; a stalled request would stop log shipping for good
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
          // keep-comment: context first, so a key named `level` or `message` cannot shadow the record
          records.map((record) => ({
            ...record.context,
            ...appInfo,
            _timestamp: new Date(record.timestamp).getTime() * 1000, // keep-comment: OpenObserve wants microseconds
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

function createEventSink(url: string, token: string) {
  return async (events: Record<string, unknown>[]) => {
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
        body: JSON.stringify(events),
      });

      if (!response.ok) {
        throw new Error(`event shipping failed: HTTP ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  };
}

// keep-comment: chains, never replaces, so the red box and any crash reporter still run
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

  // keep-comment: rejections never reach ErrorUtils; RN's tracker has no types, hence require
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
      // keep-comment: a late-handled rejection is not an incident
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

  if (EVENTS_URL && LOGS_TOKEN) {
    setEventSink(createEventSink(EVENTS_URL, LOGS_TOKEN));
  }

  // keep-comment: reads consent, never asks; until it resolves, analytics holds events unsent
  void loadConsent();

  installGlobalErrorHandlers();
}
