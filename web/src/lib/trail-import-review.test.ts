import { describe, expect, it, vi } from "vitest";
import {
  canBulkDecide,
  canSelectAllMatching,
  collectAllMatching,
  countFor,
  pageSelection,
  toggleProposal,
  togglePageSelection,
  type ProposalPage,
  type SelectableProposal,
} from "./trail-import-review";

function proposal(id: number, confidence: string): SelectableProposal {
  return { id, confidence };
}

function checkedOf(...entries: [number, string][]): Map<number, string> {
  return new Map(entries);
}

describe("canBulkDecide", () => {
  it("allows a batch the geometry settled by itself", () => {
    expect(canBulkDecide(checkedOf([1, "Certain"], [2, "High"]))).toBe(true);
  });

  // The one that matters: Medium and Unmatched are exactly the rows a human was needed
  // for, so a batch containing one must not be decidable in a click.
  it("refuses a batch holding a Medium", () => {
    expect(canBulkDecide(checkedOf([1, "Certain"], [2, "Medium"]))).toBe(false);
  });

  it("refuses a batch holding an Unmatched", () => {
    expect(canBulkDecide(checkedOf([1, "High"], [2, "Unmatched"]))).toBe(false);
  });

  it("refuses a tier it has never heard of", () => {
    expect(canBulkDecide(checkedOf([1, "Certain"], [2, "Probable"]))).toBe(false);
  });

  it("refuses an empty selection, so the button is not live with nothing chosen", () => {
    expect(canBulkDecide(new Map())).toBe(false);
  });
});

describe("toggleProposal", () => {
  it("adds a row with its tier, which is what the batch check reads", () => {
    expect(toggleProposal(new Map(), proposal(7, "High"))).toEqual(
      checkedOf([7, "High"]),
    );
  });

  it("removes a row that was already selected", () => {
    expect(toggleProposal(checkedOf([7, "High"]), proposal(7, "High"))).toEqual(
      new Map(),
    );
  });

  it("leaves the previous selection alone", () => {
    const before = checkedOf([1, "Certain"]);

    const after = toggleProposal(before, proposal(2, "High"));

    expect(after).toEqual(checkedOf([1, "Certain"], [2, "High"]));
    expect(before).toEqual(checkedOf([1, "Certain"]));
  });
});

describe("togglePageSelection", () => {
  const page = [proposal(1, "Certain"), proposal(2, "Medium")];

  it("selects the whole page when part of it is selected", () => {
    expect(togglePageSelection(checkedOf([1, "Certain"]), page)).toEqual(
      checkedOf([1, "Certain"], [2, "Medium"]),
    );
  });

  it("clears the page when all of it is selected", () => {
    const all = checkedOf([1, "Certain"], [2, "Medium"]);

    expect(togglePageSelection(all, page)).toEqual(new Map());
  });

  // Selecting across pages is the whole reason the selection is a map rather than the
  // rows in view, so clearing this page must not take the others with it.
  it("leaves rows selected on other pages alone", () => {
    const across = checkedOf([1, "Certain"], [2, "Medium"], [99, "High"]);

    expect(togglePageSelection(across, page)).toEqual(checkedOf([99, "High"]));
  });

  it("carries each row's own tier, not the first one's", () => {
    const result = togglePageSelection(new Map(), page);

    expect(result.get(1)).toBe("Certain");
    expect(result.get(2)).toBe("Medium");
  });
});

describe("pageSelection", () => {
  const page = [proposal(1, "Certain"), proposal(2, "High")];

  it("counts only the rows in view", () => {
    expect(pageSelection(checkedOf([1, "Certain"], [99, "High"]), page)).toEqual({
      onPage: 1,
      whole: false,
    });
  });

  it("is whole when every row in view is selected", () => {
    expect(pageSelection(checkedOf([1, "Certain"], [2, "High"]), page)).toEqual({
      onPage: 2,
      whole: true,
    });
  });

  it("is not whole on an empty page, which would otherwise read as complete", () => {
    expect(pageSelection(new Map(), [])).toEqual({ onPage: 0, whole: false });
  });

  it("is not whole while the page is still loading", () => {
    expect(pageSelection(checkedOf([1, "Certain"]), null)).toEqual({
      onPage: 0,
      whole: false,
    });
  });
});

describe("canSelectAllMatching", () => {
  it("is offered once the page is exhausted and the filter holds more", () => {
    expect(
      canSelectAllMatching({ onPage: 50, whole: true }, 203, checkedOf([1, "Certain"])),
    ).toBe(true);
  });

  it("is not offered until the page in view is fully selected", () => {
    expect(canSelectAllMatching({ onPage: 12, whole: false }, 203, new Map())).toBe(
      false,
    );
  });

  it("is not offered when the selection already holds everything", () => {
    const everything = checkedOf([1, "Certain"], [2, "High"]);

    expect(canSelectAllMatching({ onPage: 2, whole: true }, 2, everything)).toBe(false);
  });
});

describe("countFor", () => {
  const counts = { certain: 4, high: 3, medium: 2, unmatched: 1 };

  it("reads the count for each tier", () => {
    expect(countFor(counts, "Certain")).toBe(4);
    expect(countFor(counts, "High")).toBe(3);
    expect(countFor(counts, "Medium")).toBe(2);
    expect(countFor(counts, "Unmatched")).toBe(1);
  });

  it("reads zero rather than undefined before the session has loaded", () => {
    expect(countFor(undefined, "Certain")).toBe(0);
    expect(countFor(null, "Certain")).toBe(0);
  });

  it("reads zero for a tier the server did not send", () => {
    expect(countFor({ certain: 4 }, "Medium")).toBe(0);
  });
});

describe("collectAllMatching", () => {
  function pages(...responses: ProposalPage[]) {
    return vi.fn(async (page: number) => responses[page - 1] ?? { items: [] });
  }

  it("stops at the page the server says is the last", async () => {
    const fetchPage = pages({ items: [proposal(1, "Certain")], hasMore: false });

    const outcome = await collectAllMatching(fetchPage, 50);

    expect(outcome).toEqual({ complete: true, checked: checkedOf([1, "Certain"]) });
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it("walks every page and keeps each row's tier", async () => {
    const fetchPage = pages(
      { items: [proposal(1, "Certain")], hasMore: true },
      { items: [proposal(2, "High")], hasMore: true },
      { items: [proposal(3, "Medium")], hasMore: false },
    );

    const outcome = await collectAllMatching(fetchPage, 50);

    expect(outcome).toEqual({
      complete: true,
      checked: checkedOf([1, "Certain"], [2, "High"], [3, "Medium"]),
    });
    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([1, 2, 3]);
  });

  // The bug this exists for: without a ceiling the loop's only exit is the server's own
  // hasMore, so a server that always says there is more spins in the browser forever.
  it("gives up rather than looping forever when hasMore never turns false", async () => {
    const fetchPage = vi.fn(async () => ({
      items: [proposal(1, "Certain")],
      hasMore: true,
    }));

    const outcome = await collectAllMatching(fetchPage, 5);

    expect(outcome).toEqual({ complete: false, pagesWalked: 5 });
    expect(fetchPage).toHaveBeenCalledTimes(5);
  });

  // And it must hand back nothing: a partial selection presented as whole is what would
  // make the reviewer batch-decide a subset believing it was everything.
  it("carries no selection when it gave up", async () => {
    const fetchPage = vi.fn(async () => ({
      items: [proposal(1, "Certain")],
      hasMore: true,
    }));

    const outcome = await collectAllMatching(fetchPage, 2);

    expect(outcome).not.toHaveProperty("checked");
  });

  it("completes on the last allowed page rather than calling that giving up", async () => {
    const fetchPage = pages(
      { items: [proposal(1, "Certain")], hasMore: true },
      { items: [proposal(2, "High")], hasMore: false },
    );

    const outcome = await collectAllMatching(fetchPage, 2);

    expect(outcome).toEqual({
      complete: true,
      checked: checkedOf([1, "Certain"], [2, "High"]),
    });
  });

  it("survives a page that carries no items", async () => {
    const fetchPage = pages({ hasMore: true }, { items: [proposal(2, "High")], hasMore: false });

    const outcome = await collectAllMatching(fetchPage, 50);

    expect(outcome).toEqual({ complete: true, checked: checkedOf([2, "High"]) });
  });

  it("lets a failing page reach the caller, which is what shows the reviewer an error", async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error("HTTP error 503");
    });

    await expect(collectAllMatching(fetchPage, 50)).rejects.toThrow("HTTP error 503");
  });
});
