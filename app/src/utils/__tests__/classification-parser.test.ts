import { classificationParser } from "../classification-parser";

describe("classificationParser", () => {
  it("returns 'Inte klassificerad' for 0", () => {
    expect(classificationParser(0)).toBe("Inte klassificerad");
  });

  it("returns 'Lätt' for 1", () => {
    expect(classificationParser(1)).toBe("Lätt");
  });

  it("returns 'Medel' for 2", () => {
    expect(classificationParser(2)).toBe("Medel");
  });

  it("returns 'Svår' for 3", () => {
    expect(classificationParser(3)).toBe("Svår");
  });

  it("returns 'Inte klassificerad' for unknown numbers", () => {
    expect(classificationParser(4)).toBe("Inte klassificerad");
    expect(classificationParser(-1)).toBe("Inte klassificerad");
    expect(classificationParser(99)).toBe("Inte klassificerad");
  });
});
