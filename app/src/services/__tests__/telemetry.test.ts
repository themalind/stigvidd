// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The endpoint credentials are read at module load and the "already initialised" flag lives in
// module scope, so every test loads its own copy of the module through loadTelemetry.

import type { LogRecord } from "@/services/logger";

const mockLoggerError = jest.fn();
const mockSetLogSink = jest.fn();
const mockStartLogLifecycle = jest.fn();

jest.mock("@/services/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
  setLogSink: (...args: unknown[]) => mockSetLogSink(...args),
  startLogLifecycle: (...args: unknown[]) => mockStartLogLifecycle(...args),
}));

const mockEnableRejectionTracking = jest.fn();

jest.mock("promise/setimmediate/rejection-tracking", () => ({
  enable: (...args: unknown[]) => mockEnableRejectionTracking(...args),
}));

const URL = "https://observe.test/api/stigvidd/app/_json";
const TOKEN = "dXNlcjpwYXNzY29kZQ==";

type Sink = (records: LogRecord[]) => Promise<void>;

interface RejectionHandlers {
  allRejections: boolean;
  onUnhandled: (id: number, error: unknown) => void;
  onHandled: () => void;
}

function loadTelemetry({ url, token }: { url?: string; token?: string } = { url: URL, token: TOKEN }) {
  let module!: typeof import("@/services/telemetry");
  jest.isolateModules(() => {
    process.env.EXPO_PUBLIC_OO_LOGS_URL = url;
    process.env.EXPO_PUBLIC_OO_LOGS_TOKEN = token;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require("@/services/telemetry");
  });
  return module;
}

// The sink initTelemetry handed the logger.
function installedSink(): Sink {
  return mockSetLogSink.mock.calls[0][0] as Sink;
}

function mockFetch(ok: boolean, status = ok ? 200 : 500) {
  const fn = jest.fn().mockResolvedValue({ ok, status } as unknown as Response);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const record: LogRecord = {
  level: "error",
  message: "Kunde inte hämta leder",
  timestamp: "2026-09-07T10:00:00.000Z",
  context: { endpoint: "GET /trails" },
};

const originalEnv = { ...process.env };
let previousGlobalHandler: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  previousGlobalHandler = jest.fn();
  jest.spyOn(ErrorUtils, "getGlobalHandler").mockReturnValue(previousGlobalHandler);
  jest.spyOn(ErrorUtils, "setGlobalHandler").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe("bootstrapping", () => {
  it("ships logs once both the endpoint and the token are configured", () => {
    loadTelemetry().initTelemetry();

    expect(mockSetLogSink).toHaveBeenCalledTimes(1);
    expect(mockStartLogLifecycle).toHaveBeenCalledTimes(1);
  });

  // Jest, CI and a local dev build all run without these, and must buffer nothing and send
  // nothing rather than fail.
  it.each([
    ["neither is set", {}],
    ["only the endpoint is set", { url: URL }],
    ["only the token is set", { token: TOKEN }],
  ])("ships nothing when %s", (_case, env) => {
    loadTelemetry(env).initTelemetry();

    expect(mockSetLogSink).not.toHaveBeenCalled();
    expect(mockStartLogLifecycle).not.toHaveBeenCalled();
  });

  // Error handlers are the half that is worth having even with no log endpoint at all.
  it("installs the error handlers even with nothing configured", () => {
    loadTelemetry({}).initTelemetry();

    expect(ErrorUtils.setGlobalHandler).toHaveBeenCalledTimes(1);
    expect(mockEnableRejectionTracking).toHaveBeenCalledTimes(1);
  });

  it("is safe to call more than once", () => {
    const telemetry = loadTelemetry();
    telemetry.initTelemetry();
    telemetry.initTelemetry();

    expect(mockSetLogSink).toHaveBeenCalledTimes(1);
    expect(ErrorUtils.setGlobalHandler).toHaveBeenCalledTimes(1);
  });
});

describe("the log sink", () => {
  beforeEach(() => {
    loadTelemetry().initTelemetry();
  });

  it("posts the batch as a JSON array to the configured endpoint", async () => {
    const fetchMock = mockFetch(true);
    await installedSink()([record]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toHaveLength(1);
  });

  // An ingestion token, not a password: the value is extractable from the shipped bundle.
  it("authenticates with the ingestion token", async () => {
    const fetchMock = mockFetch(true);
    await installedSink()([record]);

    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers.Authorization).toBe(`Basic ${TOKEN}`);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("sends the timestamp in the microseconds OpenObserve expects", async () => {
    const fetchMock = mockFetch(true);
    await installedSink()([record]);

    const [entry] = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(entry._timestamp).toBe(new Date("2026-09-07T10:00:00.000Z").getTime() * 1000);
  });

  it("flattens the context alongside the record's own fields", async () => {
    const fetchMock = mockFetch(true);
    await installedSink()([record]);

    const [entry] = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(entry).toMatchObject({ level: "error", message: "Kunde inte hämta leder", endpoint: "GET /trails" });
  });

  // Nothing stops a call site passing a context key that collides with a record field, and
  // a shadowed level or message would misfile the entry in the observatory.
  it("does not let a context key shadow the record", async () => {
    const fetchMock = mockFetch(true);
    await installedSink()([
      { ...record, context: { level: "debug", message: "överskriven", _timestamp: 1 } } as LogRecord,
    ]);

    const [entry] = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(entry.level).toBe("error");
    expect(entry.message).toBe("Kunde inte hämta leder");
    expect(entry._timestamp).not.toBe(1);
  });

  it("sends one entry per record", async () => {
    const fetchMock = mockFetch(true);
    await installedSink()([record, { ...record, message: "Andra" }]);

    const entries = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(entries.map((entry: { message: string }) => entry.message)).toEqual(["Kunde inte hämta leder", "Andra"]);
  });

  // The logger retries a rejected sink; a silently dropped batch would look like success.
  it("rejects when the endpoint refuses the batch", async () => {
    mockFetch(false, 401);
    await expect(installedSink()([record])).rejects.toThrow("log shipping failed: HTTP 401");
  });
});

describe("a stalled request", () => {
  beforeEach(() => {
    loadTelemetry().initTelemetry();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // React Native's fetch has no default timeout, and the logger's `flushing` guard means one
  // held-open socket would stop log shipping for the rest of the session.
  it("is aborted rather than left holding the socket", async () => {
    let signal!: AbortSignal;
    global.fetch = jest.fn((_url, init) => {
      signal = (init as RequestInit).signal as AbortSignal;
      return new Promise(() => {});
    }) as unknown as typeof fetch;

    void installedSink()([record]);
    await Promise.resolve();
    expect(signal.aborted).toBe(false);

    jest.advanceTimersByTime(15_000);
    expect(signal.aborted).toBe(true);
  });

  it("clears its timer once the request comes back", async () => {
    mockFetch(true);
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    await installedSink()([record]);

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("clears its timer even when the request fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    await expect(installedSink()([record])).rejects.toThrow("network down");
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

describe("unhandled JS errors", () => {
  beforeEach(() => {
    loadTelemetry().initTelemetry();
  });

  function installedHandler() {
    return (ErrorUtils.setGlobalHandler as jest.Mock).mock.calls[0][0] as (error: Error, isFatal?: boolean) => void;
  }

  it("logs the error with its stack", () => {
    const error = new Error("boom");
    installedHandler()(error, true);

    expect(mockLoggerError).toHaveBeenCalledWith("Unhandled JS error", {
      name: "Error",
      errorMessage: "boom",
      stack: error.stack,
      isFatal: true,
    });
  });

  // Replacing the red box or the RUM SDK's handler would trade crash reporting for logging.
  it("still runs the handler that was already installed", () => {
    const error = new Error("boom");
    installedHandler()(error, false);

    expect(previousGlobalHandler).toHaveBeenCalledWith(error, false);
  });
});

describe("unhandled promise rejections", () => {
  beforeEach(() => {
    loadTelemetry().initTelemetry();
  });

  function handlers(): RejectionHandlers {
    return mockEnableRejectionTracking.mock.calls[0][0] as RejectionHandlers;
  }

  it("tracks every rejection, not only the ones with a handler attached", () => {
    expect(handlers().allRejections).toBe(true);
  });

  it("logs the rejection with its id", () => {
    const error = new Error("avbruten");
    handlers().onUnhandled(7, error);

    expect(mockLoggerError).toHaveBeenCalledWith("Unhandled promise rejection", {
      rejectionId: 7,
      errorMessage: "avbruten",
      stack: error.stack,
    });
  });

  // A rejection can carry anything at all, and a plain string has no .message to read.
  it("copes with a rejection that is not an Error", () => {
    handlers().onUnhandled(8, "bara en sträng");

    expect(mockLoggerError).toHaveBeenCalledWith(
      "Unhandled promise rejection",
      expect.objectContaining({ rejectionId: 8, errorMessage: "bara en sträng" }),
    );
  });

  // Handled late is not an incident.
  it("says nothing when a rejection is handled after the fact", () => {
    handlers().onHandled();

    expect(mockLoggerError).not.toHaveBeenCalled();
  });
});
