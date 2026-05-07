import FormattedTime from "../format-time-from-ms";

describe("FormattedTime", () => {
  it("returns 00:00:00 for zero milliseconds", () => {
    expect(FormattedTime(0)).toBe("00:00:00");
  });

  it("formats seconds correctly", () => {
    expect(FormattedTime(5000)).toBe("00:00:05");
    expect(FormattedTime(59000)).toBe("00:00:59");
  });

  it("formats minutes correctly", () => {
    expect(FormattedTime(60000)).toBe("00:01:00");
    expect(FormattedTime(90000)).toBe("00:01:30");
    expect(FormattedTime(59 * 60 * 1000)).toBe("00:59:00");
  });

  it("formats hours correctly", () => {
    expect(FormattedTime(3600000)).toBe("01:00:00");
    expect(FormattedTime(2 * 3600000)).toBe("02:00:00");
  });

  it("formats combined hours, minutes and seconds correctly", () => {
    // 1h 23m 45s
    const ms = (1 * 3600 + 23 * 60 + 45) * 1000;
    expect(FormattedTime(ms)).toBe("01:23:45");
  });

  it("zero-pads single digit values", () => {
    // 1h 1m 1s
    const ms = (1 * 3600 + 1 * 60 + 1) * 1000;
    expect(FormattedTime(ms)).toBe("01:01:01");
  });

  it("handles hours beyond 24", () => {
    // 100 hours
    expect(FormattedTime(100 * 3600000)).toBe("100:00:00");
  });

  it("truncates sub-second precision", () => {
    // 1500ms = 1.5 seconds → should show 1 second
    expect(FormattedTime(1500)).toBe("00:00:01");
  });
});
