import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";

/**
 * Central structured logger.
 *
 * Replaces scattered `console.log` in error paths with something that (a) always keeps the
 * console output developers already rely on, and (b) additionally ships to OpenObserve when —
 * and only when — a sink has been registered. With no sink this is a thin wrapper around
 * console: nothing buffered, nothing scheduled, nothing sent. That is what keeps
 * `npx expo start` and CI unchanged, and it is why the API tests can keep asserting exact
 * `fetch` call counts.
 *
 * The sink is registered by `initTelemetry()`; see services/telemetry.ts.
 *
 * Everything logged passes through `redact()` first. That is not a nicety — this app handles
 * Keycloak tokens, user emails and continuous GPS traces, and a hike trace identifies where
 * someone lives. See docs/observability.md.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export type LogRecord = {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
};

export type LogSink = (records: LogRecord[]) => void | Promise<void>;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const MIN_LEVEL = (process.env.EXPO_PUBLIC_LOG_LEVEL as LogLevel | undefined) ?? (__DEV__ ? "debug" : "info");

// Small enough that a crash loses little, large enough that a chatty screen does not become
// one request per line on a mobile connection.
const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 10_000;
// Hard ceiling so a device offline on a long hike cannot grow the buffer without bound.
const MAX_BUFFERED = 200;
const PENDING_STORAGE_KEY = "@stigvidd_pending_logs";

// ---- Redaction (GDPR) -------------------------------------------------------------------

// Keys whose values never leave the device. Matched as substrings, case-insensitively, so one
// entry covers `refresh_token`, `refreshToken` and `Authorization` alike.
const DENIED_KEY_PATTERNS = ["token", "password", "secret", "authorization", "credential", "cookie"];

// Coordinates are pseudonymous only in aggregate: a single hiker's trace is identifying, and a
// home address is wherever the trace starts. Dropped outright rather than rounded — two
// decimals is still ~1.1km, which is a neighbourhood.
const LOCATION_KEY_PATTERNS = ["latitude", "longitude", "coordinate", "location", "geometry"];

const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g;
const EMAIL_PATTERN = /\b[\w.+-]+@([\w-]+\.[\w.-]+)\b/g;
const COORD_PATTERN = /-?\d{1,3}\.\d{4,}/g;

const REDACTED = "[redacted]";

function matches(key: string, patterns: string[]): boolean {
  const lower = key.toLowerCase();

  return patterns.some((pattern) => lower.includes(pattern));
}

/** Scrubs identifying data out of free-form strings, which is where it usually hides — an
 * upstream error message that embedded the request it failed on. */
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

let sink: LogSink | null = null;
let buffer: LogRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscribed = false;

/** Registers the transport that receives batched records. Called once by initTelemetry(). */
export function setLogSink(next: LogSink): void {
  sink = next;
}

/** Test seam: drops the sink and any buffered records. */
export function resetLogger(): void {
  sink = null;
  buffer = [];

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

export async function flush(): Promise<void> {
  if (!sink || buffer.length === 0) return;

  const batch = buffer;
  buffer = [];

  try {
    await sink(batch);
  } catch {
    // Telemetry failure must never surface to the user or to the caller. Put the batch back
    // at the front so the next flush retries it, then let MAX_BUFFERED trim the oldest.
    buffer = [...batch, ...buffer].slice(-MAX_BUFFERED);
  }
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  // Console output is unconditional, not a fallback: the Metro logs developers already read
  // stay exactly as informative as before, which is what makes migrating call sites off
  // `console.log` a no-op behaviourally.
  const write = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (context) write(message, context);
  else write(message);

  if (!sink) return;

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
 * Backgrounding is the app's last reliable moment before the OS may kill it, so flush there
 * and persist whatever did not make it. The crash and the last few lines before it are
 * usually the same incident, so replaying them on next launch is the whole point.
 */
function handleAppStateChange(next: AppStateStatus): void {
  if (next === "active") return;

  const pending = [...buffer];

  void flush().finally(() => {
    if (pending.length === 0) return;

    void AsyncStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pending.slice(-MAX_BUFFERED))).catch(() => {
      // Nothing useful to do if the device cannot even persist a log batch.
    });
  });
}

async function replayPersistedLogs(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(PENDING_STORAGE_KEY);

    if (!stored) return;

    await AsyncStorage.removeItem(PENDING_STORAGE_KEY);
    buffer = [...(JSON.parse(stored) as LogRecord[]), ...buffer].slice(-MAX_BUFFERED);
    void flush();
  } catch {
    // A corrupt cache is not worth reporting — drop it and move on.
  }
}

/** Starts the flush-on-background and replay-on-launch behaviour. Idempotent. */
export function startLogLifecycle(): void {
  if (appStateSubscribed) return;

  appStateSubscribed = true;
  AppState.addEventListener("change", handleAppStateChange);
  void replayPersistedLogs();
}
