import issueTypeParser from "../issue-type-parser";

describe("issueTypeParser", () => {
  it("parses FallenTree", () => {
    expect(issueTypeParser("FallenTree")).toBe("Nedfallet träd");
  });

  it("parses Mud", () => {
    expect(issueTypeParser("Mud")).toBe("Lerigt");
  });

  it("parses Flooding", () => {
    expect(issueTypeParser("Flooding")).toBe("Översvämning");
  });

  it("parses Shelter", () => {
    expect(issueTypeParser("Shelter")).toBe("Vindskydd");
  });

  it("parses FirePit", () => {
    expect(issueTypeParser("FirePit")).toBe("Grillplats");
  });

  it("parses Walkway", () => {
    expect(issueTypeParser("Walkway")).toBe("Spång");
  });

  it("parses Signage", () => {
    expect(issueTypeParser("Signage")).toBe("Skyltning");
  });

  it("parses Other", () => {
    expect(issueTypeParser("Other")).toBe("Annat");
  });

  it("returns 'Annat' for unknown types", () => {
    expect(issueTypeParser("Unknown")).toBe("Annat");
    expect(issueTypeParser("")).toBe("Annat");
    expect(issueTypeParser("fallentree")).toBe("Annat"); // case sensitive
  });
});
