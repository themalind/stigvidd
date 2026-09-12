// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { MailTemplateToken } from "@/types/types";
import {
  buttonLinkStyle,
  codeParagraphStyle,
  describeLoss,
  detectLoss,
  elementInventory,
  embedTokenPlaceholders,
  extractTokens,
  htmlToPlainText,
  insertTokenAt,
  isButtonLink,
  isCodeParagraph,
  isSafeMailUrl,
  normalizeText,
  parseStyle,
  reviewTokens,
  scanHtml,
  unwrapTokenPlaceholders,
  verdictFor,
} from "./mail-template";

// The body the AddEmailVerification migration seeds, byte for byte, newlines included. If
// anything in this file stops handling THIS string, the feature is broken for the only
// template that has a production caller.
const verifyEmailHtml =
  '<p>Hej {{NickName}},</p>\n' +
  '<p>Tack för att du skapade ett konto hos Stigvidd. Klicka på knappen för att bekräfta din e-postadress, så kan du logga in.</p>\n' +
  '<p><a href="{{VerificationUrl}}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#3f6b43;color:#ffffff;text-decoration:none">Bekräfta e-postadressen</a></p>\n' +
  '<p>Fungerar inte knappen? Kopiera den här länken till din webbläsare:<br>\n' +
  '<a href="{{VerificationUrl}}">{{VerificationUrl}}</a></p>\n' +
  '<p>Du kan också skriva in den här koden i appen:</p>\n' +
  '<p style="font-size:28px;letter-spacing:6px;font-weight:700">{{VerificationCode}}</p>\n' +
  '<p>Länken och koden gäller i 24 timmar. Om det inte var du som skapade kontot kan du strunta i det här mejlet.</p>';

describe("extractTokens", () => {
  it("reads the whole string, attributes included, because the backend does", () => {
    // MailTemplateRenderer runs its regex over the raw BodyHtml. A token in an href is a
    // real token, and a count that ignored it would disagree with what gets substituted.
    expect(extractTokens('<a href="{{VerificationUrl}}">x</a>')).toEqual(["VerificationUrl"]);
  });

  it("tolerates inner whitespace, as the renderer does", () => {
    expect(extractTokens("{{  NickName  }}")).toEqual(["NickName"]);
  });

  it("treats names differing only in case as one token", () => {
    // The renderer looks the model up with OrdinalIgnoreCase, so these really are one.
    expect(extractTokens("{{NickName}} {{nickname}} {{NICKNAME}}")).toEqual(["NickName"]);
  });

  it("finds adjacent tokens separately", () => {
    expect(extractTokens("{{A}}{{B}}")).toEqual(["A", "B"]);
  });

  it("ignores a token broken up by markup, because the backend cannot substitute it either", () => {
    expect(extractTokens("{{Nick<b>Name</b>}}")).toEqual([]);
  });

  it("ignores an unclosed placeholder", () => {
    expect(extractTokens("{{NickName")).toEqual([]);
  });

  it("finds all three in the seeded verification body", () => {
    expect(extractTokens(verifyEmailHtml)).toEqual([
      "NickName",
      "VerificationUrl",
      "VerificationCode",
    ]);
  });
});

describe("scanHtml", () => {
  it("does not end a tag at a > inside a quoted attribute value", () => {
    // Without quote-awareness the tag ends early and the rest of the attribute text is
    // scanned as markup, which corrupts every transformation built on this.
    const html = '<a title="a > b" href="https://x.test">hi</a>';
    const tags = scanHtml(html).filter((piece) => piece.kind === "tag");

    expect(tags).toHaveLength(2);
    expect(tags[0].kind === "tag" && tags[0].attrs.get("href")).toBe("https://x.test");
  });

  it("treats a lone < as text rather than a tag", () => {
    const pieces = scanHtml("1 < 2 and 3 > 2");
    expect(pieces.every((piece) => piece.kind === "text")).toBe(true);
  });

  it("does not treat the contents of a raw-text element as markup", () => {
    const pieces = scanHtml("<style>p{content:'<b>'}</style>");
    expect(pieces.some((piece) => piece.kind === "rawtext")).toBe(true);
  });
});

describe("embedTokenPlaceholders / unwrapTokenPlaceholders", () => {
  it("never rewrites a token inside an attribute", () => {
    // The verification button is exactly this case. A regex over the raw string would
    // replace it and break the only link that can enable an account.
    const embedded = embedTokenPlaceholders('<a href="{{VerificationUrl}}">Verify</a>');

    expect(embedded).toBe('<a href="{{VerificationUrl}}">Verify</a>');
  });

  it("rewrites a token in text", () => {
    expect(embedTokenPlaceholders("<p>Hej {{NickName}}</p>")).toBe(
      '<p>Hej <span data-token="NickName"></span></p>',
    );
  });

  it("rewrites the link text but not the href, in the same element", () => {
    expect(embedTokenPlaceholders('<a href="{{VerificationUrl}}">{{VerificationUrl}}</a>')).toBe(
      '<a href="{{VerificationUrl}}"><span data-token="VerificationUrl"></span></a>',
    );
  });

  it("leaves a token inside a raw-text element alone", () => {
    expect(embedTokenPlaceholders("<style>a{content:'{{X}}'}</style>")).toBe(
      "<style>a{content:'{{X}}'}</style>",
    );
  });

  it("round-trips the seeded verification body exactly", () => {
    expect(unwrapTokenPlaceholders(embedTokenPlaceholders(verifyEmailHtml))).toBe(verifyEmailHtml);
  });

  it.each([
    "<p>{{A}}{{B}}</p>",
    "<p>text {{A}} more {{B}} end</p>",
    '<p title="{{A}}">{{B}}</p>',
    "<p>no tokens at all</p>",
    "<p>1 &lt; 2 &amp; 3</p>",
    "",
  ])("round-trips %j byte for byte", (html) => {
    expect(unwrapTokenPlaceholders(embedTokenPlaceholders(html))).toBe(html);
  });

  it("normalises inner whitespace, which changes bytes but not meaning", () => {
    // Measured, and worth stating rather than discovering: the chip stores the NAME, not the
    // spacing, so {{ A }} comes back as {{A}}. MailTemplateRenderer treats the two as the
    // same placeholder, so the mail is unchanged -- and detectLoss below agrees it is
    // equivalent rather than lossy, which is what keeps the guard from crying wolf.
    const embedded = embedTokenPlaceholders("<p>{{ A }}</p>");

    expect(unwrapTokenPlaceholders(embedded)).toBe("<p>{{A}}</p>");
    expect(detectLoss("<p>{{ A }}</p>", unwrapTokenPlaceholders(embedded)).lossless).toBe(true);
  });

  it("does not swallow the text between two adjacent chips", () => {
    // A greedy unwrap pattern would eat from the first chip to the last.
    const html = '<span data-token="A"></span>between<span data-token="B"></span>';

    expect(unwrapTokenPlaceholders(html)).toBe("{{A}}between{{B}}");
  });

  it("still unwraps a chip that carries extra attributes", () => {
    // So a TipTap upgrade that adds a class degrades to "still correct" rather than
    // leaving a stray <span> in somebody's mail.
    expect(unwrapTokenPlaceholders('<span class="x" data-token="A" data-y="1"></span>')).toBe(
      "{{A}}",
    );
  });

  it("never produces entity-escaped braces", () => {
    // If the braces were escaped the backend regex would stop matching, and the recipient
    // would be mailed the literal text instead of their name.
    const out = unwrapTokenPlaceholders(embedTokenPlaceholders("<p>{{NickName}}</p>"));

    expect(out).toContain("{{NickName}}");
    expect(out).not.toContain("&#123;");
  });
});

describe("detectLoss", () => {
  it("does not report the stored newlines between <p> blocks as loss", () => {
    // The single most important case. No schema-based editor reproduces those newlines, so
    // a byte comparison would call every real template lossy and the guard would be turned
    // off on day one.
    const rendered = verifyEmailHtml.replace(/\n/g, "");

    expect(detectLoss(verifyEmailHtml, rendered).lossless).toBe(true);
  });

  it("reports a dropped element", () => {
    const report = detectLoss("<table><tr><td>x</td></tr></table>", "<p>x</p>");

    expect(report.lossless).toBe(false);
    expect(report.elementsLost).toContain("table");
  });

  it("reports a dropped attribute", () => {
    const report = detectLoss(
      '<a href="https://x.test" style="color:red">x</a>',
      '<a href="https://x.test">x</a>',
    );

    expect(report.lossless).toBe(false);
    expect(report.attributesLost).toEqual([{ tag: "a", attr: "style" }]);
  });

  it("reports a dropped token in the spelling the operator wrote", () => {
    // It is compared case-insensitively, because the renderer matches that way -- but it
    // ends up in a sentence shown to the operator, and telling somebody they lost {{nickname}}
    // when they wrote {{NickName}} sends them looking for the wrong string.
    const report = detectLoss("<p>{{NickName}}</p>", "<p></p>");

    expect(report.tokensLost).toEqual(["NickName"]);
  });

  it("reports changed wording", () => {
    expect(detectLoss("<p>Hej</p>", "<p>Hallo</p>").textChanged).toBe(true);
  });

  it("does not call an ADDED wrapper a loss", () => {
    // The editor is allowed to add a paragraph; only disappearance matters.
    expect(detectLoss("<p>x</p>", "<div><p>x</p></div>").lossless).toBe(true);
  });
});

describe("verdictFor", () => {
  it("is identical only when the bytes match", () => {
    expect(verdictFor("<p>x</p>", "<p>x</p>", detectLoss("<p>x</p>", "<p>x</p>"))).toBe("identical");
  });

  it("is equivalent when nothing was lost but the bytes differ", () => {
    const stored = "<p>x</p>\n<p>y</p>";
    const rendered = "<p>x</p><p>y</p>";

    expect(verdictFor(stored, rendered, detectLoss(stored, rendered))).toBe("equivalent");
  });

  it("is lossy when something disappeared", () => {
    const stored = '<td bgcolor="#fff">x</td>';
    const rendered = "<p>x</p>";

    expect(verdictFor(stored, rendered, detectLoss(stored, rendered))).toBe("lossy");
  });
});

describe("describeLoss", () => {
  it("names what would be lost", () => {
    const report = detectLoss('<table><td bgcolor="#fff">{{A}}</td></table>', "<p></p>");
    const description = describeLoss(report);

    expect(description).toContain("{{A}}");
    expect(description).toContain("<table>");
  });
});

describe("isSafeMailUrl", () => {
  it.each(["https://stigvidd.se", "http://x.test", "mailto:a@b.test", "{{VerificationUrl}}", "{{Base}}/verify"])(
    "accepts %s",
    (url) => expect(isSafeMailUrl(url)).toBe(true),
  );

  it.each(["javascript:alert(1)", "data:text/html,x", "vbscript:x", "/relative", ""])(
    "rejects %s",
    (url) => expect(isSafeMailUrl(url)).toBe(false),
  );

  it("rejects a javascript: scheme hidden behind an entity", () => {
    expect(isSafeMailUrl("&#106;avascript:alert(1)")).toBe(false);
  });

  it("rejects a scheme broken up by a control character", () => {
    expect(isSafeMailUrl("java\tscript:alert(1)")).toBe(false);
  });

  it("accepts an entity-encoded legitimate scheme", () => {
    expect(isSafeMailUrl("&#104;ttps://stigvidd.se")).toBe(true);
  });
});

describe("style recognition", () => {
  it("recognises the seeded button, which is what makes the preset a no-op on it", () => {
    const anchor = scanHtml(verifyEmailHtml).find(
      (piece) => piece.kind === "tag" && piece.tag === "a" && piece.attrs.has("style"),
    );

    expect(anchor?.kind === "tag" && isButtonLink(anchor.attrs.get("style"))).toBe(true);
  });

  it("recognises the same declarations written in a different order", () => {
    // Recognition is fuzzy so a hand-written variant still lights the toolbar; rewriting
    // stays explicit, so it is never normalised behind the operator's back.
    const reordered = parseStyle(buttonLinkStyle);
    const shuffled = [...reordered].reverse().map(([k, v]) => `${k}: ${v}`).join("; ");

    expect(isButtonLink(shuffled)).toBe(true);
  });

  it("does not recognise a button with an extra declaration", () => {
    expect(isButtonLink(`${buttonLinkStyle};font-weight:600`)).toBe(false);
  });

  it("recognises the code paragraph", () => {
    expect(isCodeParagraph(codeParagraphStyle)).toBe(true);
  });

  it("is false for no style at all", () => {
    expect(isButtonLink(null)).toBe(false);
    expect(isButtonLink(undefined)).toBe(false);
  });
});

describe("reviewTokens", () => {
  const known: MailTemplateToken[] = [
    { name: "NickName", label: "Nickname", description: "", sampleValue: "Ralf", isUsed: false },
    { name: "VerificationUrl", label: "Link", description: "", sampleValue: "https://x", isUsed: false },
  ];

  it("names a token the caller does not supply", () => {
    const report = reviewTokens(
      { subject: "Hej", bodyHtml: "<p>{{NickNmae}}</p>", bodyText: "" },
      known,
    );

    expect(report.unknown).toEqual(["NickNmae"]);
  });

  it("names a supplied token the copy does not use", () => {
    const report = reviewTokens(
      { subject: "Hej", bodyHtml: "<p>{{NickName}}</p>", bodyText: "{{NickName}}" },
      known,
    );

    expect(report.unknown).toEqual([]);
    expect(report.missing).toEqual(["VerificationUrl"]);
  });

  it("checks the subject too", () => {
    // The seeded "welcome" subject is "Välkommen till Stigvidd, {{NickName}}!", so the
    // subject is a real place for a token and a bad one there stops the mail the same way.
    const report = reviewTokens(
      { subject: "Hej {{Nonsense}}", bodyHtml: "", bodyText: "" },
      known,
    );

    expect(report.unknown).toEqual(["Nonsense"]);
  });

  it("matches case-insensitively, so {{nickname}} is not called unknown", () => {
    const report = reviewTokens({ subject: "", bodyHtml: "{{nickname}}", bodyText: "" }, known);

    expect(report.unknown).toEqual([]);
  });

  it("condemns nothing when the template key itself is not described", () => {
    // An orphaned row: we do not know what its caller passes, so calling everything in it
    // unknown would make it uneditable and say something untrue.
    const report = reviewTokens({ subject: "", bodyHtml: "{{Whatever}}", bodyText: "" }, null);

    expect(report.unknown).toEqual([]);
  });
});

describe("htmlToPlainText", () => {
  it("keeps placeholders intact", () => {
    expect(htmlToPlainText("<p>Hej {{NickName}}</p>")).toBe("Hej {{NickName}}");
  });

  it("turns paragraphs into blank-line separated blocks", () => {
    expect(htmlToPlainText("<p>one</p><p>two</p>")).toBe("one\n\ntwo");
  });

  it("turns <br> into a single newline", () => {
    expect(htmlToPlainText("<p>one<br>two</p>")).toBe("one\ntwo");
  });

  it("decodes entities", () => {
    expect(htmlToPlainText("<p>a &amp; b &lt;c&gt;</p>")).toBe("a & b <c>");
  });

  it("drops the markup of a link but keeps its text", () => {
    expect(htmlToPlainText('<p><a href="https://x.test">Verify</a></p>')).toBe("Verify");
  });
});

describe("normalizeText", () => {
  it("ignores markup and collapses whitespace", () => {
    expect(normalizeText("<p>Hej   {{A}}</p>\n<p>då</p>")).toBe("Hej {{A}} då");
  });
});

describe("elementInventory", () => {
  it("counts opening tags and collects their attributes", () => {
    const inventory = elementInventory('<p style="x">a</p><p>b</p>');

    expect(inventory.get("p")?.count).toBe(2);
    expect([...(inventory.get("p")?.attrs ?? [])]).toContain("style");
  });
});

describe("insertTokenAt", () => {
  it("inserts at the caret and reports where the caret should land", () => {
    expect(insertTokenAt("Hej !", 4, 4, "NickName")).toEqual({
      value: "Hej {{NickName}}!",
      caret: 16,
    });
  });

  it("replaces a selection", () => {
    expect(insertTokenAt("Hej NAME!", 4, 8, "NickName").value).toBe("Hej {{NickName}}!");
  });

  it("clamps a caret past the end", () => {
    expect(insertTokenAt("Hej", 99, 99, "A").value).toBe("Hej{{A}}");
  });
});
