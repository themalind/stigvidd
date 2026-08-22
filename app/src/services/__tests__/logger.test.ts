import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import {
  logger,
  redact,
  redactString,
  setLogSink,
  resetLogger,
  startLogLifecycle,
  flush,
  SINK_TIMEOUT_MS,
  LogRecord,
} from "../logger";

describe("logger redaction", () => {
  // These assertions are the GDPR guarantee in executable form: this app handles Keycloak
  // tokens, user emails and GPS traces, and a hike trace identifies where someone lives.
  // See docs/observability.md.

  it("drops credential-bearing keys entirely rather than truncating them", () => {
    const result = redact({
      accessToken: "eyJhbGciOiJIUzI1NiJ9.payload.sig",
      refresh_token: "abc",
      Authorization: "Bearer xyz",
      password: "hunter2",
      userId: "keep-me",
    });

    expect(result).toEqual({
      accessToken: "[redacted]",
      refresh_token: "[redacted]",
      Authorization: "[redacted]",
      password: "[redacted]",
      // The opaque subject id is the join key that makes logs useful, and is kept.
      userId: "keep-me",
    });
  });

  it("drops location keys, because a start-of-trace point is plausibly someone's home", () => {
    expect(redact({ latitude: 57.7231, longitude: 12.9401, coordinates: [1, 2] })).toEqual({
      latitude: "[redacted]",
      longitude: "[redacted]",
      coordinates: "[redacted]",
    });
  });

  it("scrubs identifiers embedded in free-form strings", () => {
    expect(redactString("failed for ada@example.com")).toBe("failed for ***@example.com");
    expect(redactString("sent Bearer abc.def_ghi")).toBe("sent Bearer [redacted]");
    expect(redactString("token eyJhbG.eyJzdWI.sig")).toBe("token [redacted]");
    expect(redactString("at 57.72314,12.94012")).toBe("at [redacted],[redacted]");
  });

  it("redacts nested context and bounds recursion depth", () => {
    expect(redact({ outer: { inner: { password: "x", note: "a@b.co" } } })).toEqual({
      outer: { inner: { password: "[redacted]", note: "***@b.co" } },
    });
  });

  it("leaves ordinary diagnostic values alone", () => {
    expect(redact({ endpoint: "GET /trails", status: 500, pointCount: 42 })).toEqual({
      endpoint: "GET /trails",
      status: 500,
      pointCount: 42,
    });
  });
});

describe("logger sink", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    resetLogger();
    jest.clearAllMocks();
  });

  it("does nothing but write to console when no sink is registered", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    logger.error("boom", { endpoint: "GET /trails" });

    // The console output developers rely on is unconditional...
    expect(spy).toHaveBeenCalledWith("boom", { endpoint: "GET /trails" });
    // ...but nothing is buffered or sent, which is why the API tests can keep asserting
    // exact fetch call counts.
    expect(jest.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it("delivers redacted records to a registered sink", async () => {
    const sink = jest.fn();
    jest.spyOn(console, "error").mockImplementation(() => {});
    setLogSink(sink);

    logger.error("upload failed for ada@example.com", { accessToken: "secret", status: 500 });
    await flush();

    expect(sink).toHaveBeenCalledTimes(1);
    const [records] = sink.mock.calls[0] as [LogRecord[]];
    expect(records).toHaveLength(1);
    expect(records[0].message).toBe("upload failed for ***@example.com");
    expect(records[0].context).toEqual({ accessToken: "[redacted]", status: 500 });
    expect(records[0].level).toBe("error");
  });

  it("keeps the batch for retry when the sink throws", async () => {
    const sink = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    jest.spyOn(console, "error").mockImplementation(() => {});
    setLogSink(sink);

    logger.error("first");
    await flush();
    await flush();

    // Same record delivered again rather than dropped on the floor.
    expect(sink).toHaveBeenCalledTimes(2);
    const [retried] = sink.mock.calls[1] as [LogRecord[]];
    expect(retried[0].message).toBe("first");
  });
});

describe("logger sink watchdog", () => {
  afterEach(() => {
    resetLogger();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("recovers from a sink that never settles instead of wedging every later flush", async () => {
    jest.useFakeTimers();
    jest.spyOn(console, "error").mockImplementation(() => {});

    // What a stalled request looks like from the logger's side: React Native's fetch is
    // XHR-backed and has no default timeout. Without the watchdog `flushing` stays true
    // forever, and no later flush — timer, batch or background — ever sends again.
    const stuck = jest.fn().mockReturnValue(new Promise<void>(() => {}));
    setLogSink(stuck);

    logger.error("first");
    const inFlight = flush();

    await jest.advanceTimersByTimeAsync(SINK_TIMEOUT_MS);
    await inFlight;

    // The logger is usable again, and the undelivered record is retried rather than dropped.
    const healthy = jest.fn().mockResolvedValue(undefined);
    setLogSink(healthy);
    await flush();

    expect(stuck).toHaveBeenCalledTimes(1);
    expect(healthy).toHaveBeenCalledTimes(1);

    const [retried] = healthy.mock.calls[0] as [LogRecord[]];
    expect(retried[0].message).toBe("first");
  });
});

describe("logger lifecycle", () => {
  // The risk in the flush-on-background path is not losing records but delivering them TWICE:
  // persisting a snapshot taken BEFORE the flush replays already-shipped records on the next
  // launch, duplicating them on every background/foreground cycle.

  const PENDING_KEY = "@stigvidd_pending_logs";

  let background!: () => void;

  /** Drains microtasks so the chained flush -> persist promises have run. */
  const settle = async () => {
    for (let i = 0; i < 3; i++) await new Promise((resolve) => setImmediate(resolve));
  };

  beforeAll(() => {
    // startLogLifecycle() subscribes once per module instance, so capture the handler here
    // rather than per-test.
    jest.spyOn(AppState, "addEventListener").mockImplementation(((
      _type: string,
      handler: (state: AppStateStatus) => void,
    ) => {
      background = () => handler("background" as AppStateStatus);

      return { remove: jest.fn() };
    }) as typeof AppState.addEventListener);

    startLogLifecycle();
  });

  beforeEach(async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    await AsyncStorage.clear();
  });

  afterEach(() => {
    resetLogger();
  });

  it("leaves nothing to replay when the background flush succeeds", async () => {
    // A stale entry from an earlier session: a successful flush must clear it, not add to it.
    await AsyncStorage.setItem(
      PENDING_KEY,
      JSON.stringify([{ level: "error", message: "stale", timestamp: "2026-08-22T00:00:00.000Z" }]),
    );

    const sink = jest.fn().mockResolvedValue(undefined);
    setLogSink(sink);

    logger.error("boom");
    background();
    await settle();

    expect(sink).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("persists the undelivered batch when the background flush fails", async () => {
    const sink = jest.fn().mockRejectedValue(new Error("offline"));
    setLogSink(sink);

    logger.error("boom");
    background();
    await settle();

    const stored = await AsyncStorage.getItem(PENDING_KEY);
    expect(stored).not.toBeNull();

    const persisted = JSON.parse(stored as string) as LogRecord[];
    expect(persisted).toHaveLength(1);
    expect(persisted[0].message).toBe("boom");
  });
});

describe("logger backoff", () => {
  afterEach(() => {
    resetLogger();
    jest.restoreAllMocks();
  });

  it("stops hammering a failing sink once a full batch is buffered", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const sink = jest.fn().mockRejectedValue(new Error("offline"));
    setLogSink(sink);

    // 20 records is BATCH_SIZE, so this triggers exactly one flush attempt...
    for (let i = 0; i < 20; i++) logger.error(`line ${i}`);
    await new Promise((resolve) => setImmediate(resolve));
    expect(sink).toHaveBeenCalledTimes(1);

    // ...and the restored batch keeps the buffer at BATCH_SIZE. Without the failure guard
    // every one of these would fire its own request at the known-broken endpoint.
    for (let i = 0; i < 20; i++) logger.error(`more ${i}`);
    await new Promise((resolve) => setImmediate(resolve));
    expect(sink).toHaveBeenCalledTimes(1);
  });
});
