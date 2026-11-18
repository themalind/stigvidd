// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";

// keep-comment: without a sink this is only console, so dev, CI and the API tests' fetch counts are unchanged
// keep-comment: everything goes through redact(): tokens, emails and GPS traces (a trace shows where someone lives)

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

  // keep-comment: validated, since a typo would compare against undefined and turn on debug logging in production
  if (configured && configured in LEVEL_ORDER) return configured as LogLevel;

  return __DEV__ ? "debug" : "info";
}

const MIN_LEVEL = resolveMinLevel();

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 10_000;
// keep-comment: so a device offline on a long hike cannot grow the buffer without bound
const MAX_BUFFERED = 200;
const PENDING_STORAGE_KEY = "@stigvidd_pending_logs";
// keep-comment: RN fetch has no timeout; a sink that never settles keeps `flushing` set and stops shipping for good
export const SINK_TIMEOUT_MS = 30_000;

// keep-comment: substrings, case-insensitive, so one entry covers refresh_token, refreshToken and Authorization
const DENIED_KEY_PATTERNS = ["token", "password", "secret", "authorization", "credential", "cookie"];

// keep-comment: dropped, not rounded: a trace starts at someone's home, and two decimals is still a neighbourhood
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

// keep-comment: free text is where it hides, such as an error message quoting its request
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
    // keep-comment: never truncated, since a token prefix is still a fingerprint
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

let sink: LogSink | null = null;
let buffer: LogRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscribed = false;
let flushing = false;
let inFlight: LogRecord[] = [];
let inBackground = false;
let persisting = false;
let persistAgain = false;
let storageHoldsRecords = false;
// keep-comment: backoff, or offline every log line costs a request (a restored batch keeps the buffer full)
let failureStreak = 0;
const MAX_BACKOFF_MULTIPLIER = 16;

export function setLogSink(next: LogSink): void {
  sink = next;
}

export function resetLogger(): void {
  sink = null;
  buffer = [];
  flushing = false;
  inFlight = [];
  inBackground = false;
  persistAgain = false;
  storageHoldsRecords = false;
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
  // keep-comment: one flush at a time, or a failed batch is put back out of order
  if (flushing || !sink || buffer.length === 0) return;

  const batch = buffer;
  buffer = [];
  inFlight = batch;
  flushing = true;

  try {
    await settleWithin(sink(batch), SINK_TIMEOUT_MS);
    failureStreak = 0;
  } catch {
    // keep-comment: never surfaces to the user; the batch goes back for the next flush
    buffer = [...batch, ...buffer].slice(-MAX_BUFFERED);
    failureStreak += 1;
    // keep-comment: nothing else re-arms the timer, since emit() only schedules below BATCH_SIZE
    scheduleFlush(retryDelayMs());
  } finally {
    inFlight = [];
    flushing = false;
    if (inBackground || storageHoldsRecords) persistUndelivered();
  }
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

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

  // keep-comment: a line logged after the background transition would otherwise die with the process
  if (inBackground) persistUndelivered();

  // keep-comment: while failing, the backoff timer owns retries
  if (failureStreak === 0 && buffer.length >= BATCH_SIZE) void flush();
  else scheduleFlush(failureStreak > 0 ? retryDelayMs() : FLUSH_INTERVAL_MS);
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};

// keep-comment: backgrounding is the last reliable moment before the OS may kill the app; the rest replays next launch
function handleAppStateChange(next: AppStateStatus): void {
  inBackground = next !== "active";
  if (!inBackground) return;

  persistUndelivered();
  void flush();
}

// keep-comment: the in-flight batch is stored too, and flush() re-stores once settled so a shipped batch is not replayed
function persistUndelivered(): void {
  if (persisting) {
    persistAgain = true;
    return;
  }

  persisting = true;
  const records = [...inFlight, ...buffer].slice(-MAX_BUFFERED);
  storageHoldsRecords = records.length > 0;
  void persistPending(records).finally(() => {
    persisting = false;
    if (!persistAgain) return;
    persistAgain = false;
    persistUndelivered();
  });
}

async function persistPending(records: LogRecord[]): Promise<void> {
  try {
    if (records.length === 0) await AsyncStorage.removeItem(PENDING_STORAGE_KEY);
    else await AsyncStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // keep-comment: nothing to do if even storage fails
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
    // keep-comment: a corrupt cache is dropped unreported
  }
}

export function startLogLifecycle(): void {
  if (appStateSubscribed) return;

  appStateSubscribed = true;
  // keep-comment: a background relaunch (location task after a kill) never gets a change event
  inBackground = AppState.currentState === "background";
  AppState.addEventListener("change", handleAppStateChange);
  void replayPersistedLogs();
}
