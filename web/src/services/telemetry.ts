// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Structured logging for the admin web, shipped to OpenObserve's bulk JSON ingest.
 *
 * Strictly OPT-IN, and in the same registration-time sense the backend's
 * TelemetryExtensions is: with `VITE_OO_LOGS_URL` or `VITE_OO_LOGS_TOKEN` absent no sink is
 * installed, nothing is buffered and no request is ever made. That is what keeps `npm run
 * dev`, Vitest and CI unaffected, and it is why the tests can keep asserting exact `fetch`
 * call counts.
 *
 * NOTE ON THE CREDENTIAL — this one is worse than the app's, and knowingly so. Vite inlines
 * every `VITE_*` var into the bundle at BUILD time, and that bundle is served publicly from
 * the web domain, so this token is readable by any anonymous visitor with one `curl` — no
 * APK to extract first. It must therefore be an INGESTION TOKEN (base64 of "user:passcode",
 * from OpenObserve's Ingestion page), never a login password: on OpenObserve OSS there is no
 * RBAC, so a password would let anyone who viewed this page read every stream in the
 * instance and create admin users. Measured against v0.92.2 — a passcode answers 401 on
 * /_search and /users, a password answers 200. See docs/notes/openobserve-oss-has-no-rbac.md.
 *
 * Rotating it therefore means a REBUILD and redeploy of this image, not a restart.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

export type LogRecord = {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
};

const LOGS_URL = import.meta.env.VITE_OO_LOGS_URL;
const LOGS_TOKEN = import.meta.env.VITE_OO_LOGS_TOKEN;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Debug lines are for the devtools console, not for the observatory: they are the highest
// volume and the lowest value, and every one of them costs disk under a 7-day retention that
// is also a GDPR control. Deliberately a constant rather than a VITE_LOG_LEVEL variable —
// this is baked at build time like everything else here, so a variable could not be changed
// when it mattered anyway, and it would be one more public value to get wrong.
const MIN_SHIPPED_LEVEL: LogLevel = "info";

// An admin browser session is short and online, so this is smaller and more eager than the
// app's equivalent — there is no offline hike to buffer through.
const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 10_000;
const MAX_BUFFERED = 200;
const REQUEST_TIMEOUT_MS = 15_000;

// ---- Redaction (GDPR) -------------------------------------------------------------------

// Deliberately duplicated from app/src/services/logger.ts rather than shared: the two areas
// carry different licences (AGPL here, MPL there) and share no build, and a redaction rule is
// exactly the kind of thing that must not silently weaken on one side because the other
// needed it to.
const DENIED_KEY_PATTERNS = [
  "token",
  "password",
  "secret",
  "authorization",
  "credential",
  "cookie",
];

// The admin web renders trail geometry, and a trail's coordinates are the product's data —
// but a log line carrying them is still an uncontrolled copy outside the database's retention.
const LOCATION_KEY_PATTERNS = [
  "latitude",
  "longitude",
  "coordinate",
  "location",
  "geometry",
];

const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g;
const EMAIL_PATTERN = /\b[\w.+-]+@([\w-]+\.[\w.-]+)\b/g;
const COORD_PATTERN = /-?\d{1,3}\.\d{4,}/g;

const REDACTED = "[redacted]";

function matches(key: string, patterns: string[]): boolean {
  const lower = key.toLowerCase();

  return patterns.some((pattern) => lower.includes(pattern));
}

/**
 * Scrubs identifying data out of free-form strings, which is where it usually hides — an
 * upstream error message that embedded the request it failed on.
 */
export function redactString(value: string): string {
  return value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(JWT_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, (_match, domain: string) => `***@${domain}`)
    .replace(COORD_PATTERN, REDACTED);
}

function redactValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= 4) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1));

  return redactObject(value as LogContext, depth + 1);
}

function redactObject(context: LogContext, depth: number): LogContext {
  const output: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    // Dropped entirely, never truncated: a token prefix is still a fingerprint.
    if (matches(key, DENIED_KEY_PATTERNS) || matches(key, LOCATION_KEY_PATTERNS)) {
      output[key] = REDACTED;
      continue;
    }

    output[key] = redactValue(value, depth);
  }

  return output;
}

export function redact(context?: LogContext): LogContext | undefined {
  return context ? redactObject(context, 0) : undefined;
}

// ---- Buffering + emit -------------------------------------------------------------------

let enabled = false;
let buffer: LogRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let initialised = false;
let listenersBound = false;

/** Test seam: drops everything this module accumulated, including the enabled flag. */
export function resetTelemetry(): void {
  enabled = false;
  buffer = [];
  flushing = false;
  initialised = false;

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Ships a batch to `POST /api/<org>/<stream>/_json`.
 *
 * `keepalive` lets the request outlive the page, which is the only reason a flush on
 * `visibilitychange` is worth doing at all. `navigator.sendBeacon` would be the usual tool
 * and is NOT usable here: it cannot set an `Authorization` header, and OpenObserve's `_json`
 * endpoint takes HTTP Basic.
 */
async function ship(records: LogRecord[], keepalive: boolean): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(LOGS_URL!, {
      method: "POST",
      signal: controller.signal,
      keepalive,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${LOGS_TOKEN}`,
      },
      body: JSON.stringify(
        // Context is spread FIRST so a context key named `level`, `message` or `_timestamp`
        // cannot shadow the record's own fields.
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
}

export async function flush(keepalive = false): Promise<void> {
  if (flushing || !enabled || buffer.length === 0) return;

  const batch = buffer;
  buffer = [];
  flushing = true;

  try {
    await ship(batch, keepalive);
  } catch {
    // Telemetry failure must never surface to the user. Put the batch back at the front so
    // the next flush retries it, then let MAX_BUFFERED trim the oldest.
    buffer = [...batch, ...buffer].slice(-MAX_BUFFERED);
    scheduleFlush();
  } finally {
    flushing = false;
  }
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  // Console output is unconditional, not a fallback: the devtools output developers already
  // read stays exactly as informative as before.
  const write =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (context) write(message, context);
  else write(message);

  if (!enabled || LEVEL_ORDER[level] < LEVEL_ORDER[MIN_SHIPPED_LEVEL]) return;

  buffer.push({
    level,
    message: redactString(message),
    timestamp: new Date().toISOString(),
    context: redact(context),
  });

  if (buffer.length > MAX_BUFFERED) buffer = buffer.slice(-MAX_BUFFERED);

  if (buffer.length >= BATCH_SIZE) void flush();
  else scheduleFlush();
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};

// ---- Lifecycle --------------------------------------------------------------------------

/**
 * Both handlers CHAIN rather than replace, so whatever is already installed still runs.
 * Replacing them would silently disable something else's error reporting to gain logging.
 */
function installGlobalErrorHandlers(): void {
  if (listenersBound) return;

  listenersBound = true;

  window.addEventListener("error", (event: ErrorEvent) => {
    logger.error("Unhandled JS error", {
      name: event.error?.name,
      errorMessage: event.message,
      stack: event.error?.stack,
      source: event.filename,
    });
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const rejection =
      event.reason instanceof Error ? event.reason : new Error(String(event.reason));

    logger.error("Unhandled promise rejection", {
      errorMessage: rejection.message,
      stack: rejection.stack,
    });
  });

  // A tab being hidden is the last reliable moment before it may be discarded — `unload`
  // never fires on mobile Safari and is unreliable everywhere else.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush(true);
  });
}

/**
 * Telemetry bootstrap: one call, safe to make unconditionally, idempotent.
 *
 * Called at module scope from main.tsx rather than in an effect, so that an error thrown
 * while React is still mounting — exactly the kind worth having — is already covered.
 */
export function initTelemetry(): void {
  if (initialised) return;

  initialised = true;

  if (!LOGS_URL || !LOGS_TOKEN) return;

  enabled = true;
  installGlobalErrorHandlers();
}
