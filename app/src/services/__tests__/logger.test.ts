import { logger, redact, redactString, setLogSink, resetLogger, flush, LogRecord } from "../logger";

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
