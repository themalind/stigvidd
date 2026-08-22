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

function resolveMinLevel(): LogLevel {
  const configured = process.env.EXPO_PUBLIC_LOG_LEVEL;

  // Validated rather than cast. An unrecognised value would make every LEVEL_ORDER lookup
  // below compare against `undefined` — always false — silently promoting a production build
  // to debug logging, which is the opposite of what a typo here should do.
  if (configured && configured in LEVEL_ORDER) return configured as LogLevel;

  return __DEV__ ? "debug" : "info";
}

const MIN_LEVEL = resolveMinLevel();

// Small enough that a crash loses little, large enough that a chatty screen does not become
// one request per line on a mobile connection.
const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 10_000;
// Hard ceiling so a device offline on a long hike cannot grow the buffer without bound.
const MAX_BUFFERED = 200;
const PENDING_STORAGE_KEY = "@stigvidd_pending_logs";
// A sink is arbitrary caller-supplied code, and the HTTP one wraps fetch, which on React
// Native is XHR-backed and has NO default timeout. If a sink never settles, `flushing` never
// clears and every later flush — timer, batch and background alike — returns at the guard in
// flush(), so log shipping stops silently for the rest of the process lifetime. Bounding it
// here turns a stall into an ordinary failure, which the retry and backoff path already
// handles. Exported so the test can advance to it rather than wait it out.
export const SINK_TIMEOUT_MS = 30_000;

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
let flushing = false;
// Consecutive sink failures back the retry interval off. Without this a device with no
// connectivity, or an OpenObserve outage, costs one HTTP attempt per log line: a restored
// batch keeps the buffer at or above BATCH_SIZE, so every subsequent emit() would flush.
let failureStreak = 0;
const MAX_BACKOFF_MULTIPLIER = 16;

/** Registers the transport that receives batched records. Called once by initTelemetry(). */
export function setLogSink(next: LogSink): void {
  sink = next;
}

/** Test seam: drops the sink and any buffered records. */
export function resetLogger(): void {
  sink = null;
  buffer = [];
  flushing = false;
  failureStreak = 0;

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function scheduleFlush(delayMs: number = FLUSH_INTERVAL_MS): void {
  if (flushTimer) return;

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, delayMs);
}

function retryDelayMs(): number {
  return FLUSH_INTERVAL_MS * Math.min(2 ** failureStreak, MAX_BACKOFF_MULTIPLIER);
}

/** Resolves with the sink, or rejects once SINK_TIMEOUT_MS passes, so `flushing` always clears. */
function settleWithin(result: void | Promise<void>, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("log sink timed out")), timeoutMs);

    void Promise.resolve(result).then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export async function flush(): Promise<void> {
  // Overlapping flushes would let a failed batch be prepended to a buffer a concurrent flush
  // has already taken, reordering records for no gain.
  if (flushing || !sink || buffer.length === 0) return;

  const batch = buffer;
  buffer = [];
  flushing = true;

  try {
    await settleWithin(sink(batch), SINK_TIMEOUT_MS);
    failureStreak = 0;
  } catch {
    // Telemetry failure must never surface to the user or to the caller. Put the batch back
    // at the front so the next flush retries it, then let MAX_BUFFERED trim the oldest.
    buffer = [...batch, ...buffer].slice(-MAX_BUFFERED);
    failureStreak += 1;
    // Nothing else re-arms the timer: emit() only schedules when the buffer is under
    // BATCH_SIZE, and a restored batch is usually over it.
    scheduleFlush(retryDelayMs());
  } finally {
    flushing = false;
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

  // While the sink is failing, the backoff timer owns retries — flushing straight from here
  // would be one HTTP attempt per log line against a known-broken endpoint.
  if (failureStreak === 0 && buffer.length >= BATCH_SIZE) void flush();
  else scheduleFlush(failureStreak > 0 ? retryDelayMs() : FLUSH_INTERVAL_MS);
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

  void flush().finally(() => {
    // Whatever the flush did NOT deliver — nothing at all after a success. Persisting a
    // snapshot taken before the flush instead would replay already-shipped records on the
    // next launch, duplicating them on every single background/foreground cycle.
    void persistPending(buffer.slice(-MAX_BUFFERED));
  });
}

async function persistPending(records: LogRecord[]): Promise<void> {
  try {
    if (records.length === 0) await AsyncStorage.removeItem(PENDING_STORAGE_KEY);
    else await AsyncStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Nothing useful to do if the device cannot even persist a log batch.
  }
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
