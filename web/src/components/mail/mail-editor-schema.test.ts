// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Fidelity of the editor's document model against the mail bodies this project actually
// ships. ProseMirror's parser and serializer are pure DOM-API code with no layout dependency,
// so a headless Editor works under jsdom -- which makes this the one part of a WYSIWYG that
// CAN be tested, and it happens to be the part that matters. Typing cannot be tested at all
// (jsdom does not implement editing), so nothing here tries to.

import { describe, expect, it } from "vitest";
import { roundTripThroughSchema } from "./mail-editor-schema";
import {
  detectLoss,
  extractTokens,
  isButtonLink,
  isCodeParagraph,
  verdictFor,
} from "@/lib/mail-template";

// Byte for byte from 20260912125829_AddEmailVerification.
const verifyEmailHtml =
  '<p>Hej {{NickName}},</p>\n' +
  '<p>Tack för att du skapade ett konto hos Stigvidd. Klicka på knappen för att bekräfta din e-postadress, så kan du logga in.</p>\n' +
  '<p><a href="{{VerificationUrl}}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#3f6b43;color:#ffffff;text-decoration:none">Bekräfta e-postadressen</a></p>\n' +
  '<p>Fungerar inte knappen? Kopiera den här länken till din webbläsare:<br>\n' +
  '<a href="{{VerificationUrl}}">{{VerificationUrl}}</a></p>\n' +
  '<p>Du kan också skriva in den här koden i appen:</p>\n' +
  '<p style="font-size:28px;letter-spacing:6px;font-weight:700">{{VerificationCode}}</p>\n' +
  '<p>Länken och koden gäller i 24 timmar. Om det inte var du som skapade kontot kan du strunta i det här mejlet.</p>';

// Byte for byte from 20260912103250_AddMailOutbox.
const welcomeHtml =
  '<p>Hej {{NickName}},</p>\n' +
  '<p>Välkommen till Stigvidd. Nu kan du hitta leder, spara dina vandringar och dela dem med dina vänner.</p>\n' +
  '<p>Trevlig vandring!</p>';

describe("the seeded verify-email body", () => {
  const rendered = roundTripThroughSchema(verifyEmailHtml);

  it("loses nothing", () => {
    // If this ever goes red, the visual editor would rewrite the only template that stands
    // between a new account and being able to log in.
    const loss = detectLoss(verifyEmailHtml, rendered);

    expect(loss).toMatchObject({
      lossless: true,
      tokensLost: [],
      elementsLost: [],
      attributesLost: [],
      textChanged: false,
    });
  });

  it("is equivalent rather than identical, because the stored newlines do not survive", () => {
    // Naming the expected difference, so nobody later "fixes" it by loosening the guard.
    expect(verdictFor(verifyEmailHtml, rendered, detectLoss(verifyEmailHtml, rendered)))
      .toBe("equivalent");
  });

  it("keeps all three placeholders", () => {
    expect(extractTokens(rendered)).toEqual(["NickName", "VerificationUrl", "VerificationCode"]);
  });

  it("keeps the placeholder inside the href, which is the verification link itself", () => {
    expect(rendered).toContain('href="{{VerificationUrl}}"');
  });

  it("keeps the button's inline styling", () => {
    // TipTap drops unknown attributes by default; without the passthrough extension the
    // button silently becomes a plain link.
    const style = /<a[^>]*style="([^"]*)"/.exec(rendered)?.[1];

    expect(style).toBeDefined();
    expect(isButtonLink(style)).toBe(true);
  });

  it("keeps the letter-spaced code paragraph", () => {
    const style = /<p style="([^"]*)"/.exec(rendered)?.[1];

    expect(isCodeParagraph(style)).toBe(true);
  });

  it("re-serialises style VALUES through the CSSOM, which is why recognition normalises them", () => {
    // Measured, and production behaviour rather than a jsdom quirk: jsdom leaves a
    // setAttribute style attribute completely alone, so it is ProseMirror writing
    // style.cssText that makes the browser reparse it. #3f6b43 comes back as rgb(63, 107, 67).
    //
    // Nothing is LOST by this -- detectLoss compares attribute names, and the colours render
    // identically -- and because the page only saves a body the operator actually edited, it
    // is not a silent rewrite. But it is why isButtonLink compares normalised values.
    expect(rendered).toContain("rgb(63, 107, 67)");
    expect(rendered).not.toContain("#3f6b43");
  });

  it("wraps the bold code paragraph in <strong>, which is an addition and not a loss", () => {
    // font-weight:700 in the paragraph style is parsed by StarterKit's Bold as a bold mark,
    // so the text comes back marked up as well as styled. It renders the same, detectLoss
    // ignores additions, and calling it out here means the next person meets it in a test
    // rather than in a diff.
    expect(rendered).toContain("<strong>{{VerificationCode}}</strong>");
  });

  it("does not invent rel or target on the links", () => {
    // TipTap's Link ships with rel="noopener noreferrer nofollow" and target="_blank" on by
    // default. Left on, merely opening this page would rewrite every template that has a
    // link in it, whether or not the operator changed anything.
    expect(rendered).not.toContain("rel=");
    expect(rendered).not.toContain("target=");
  });

  it("never entity-escapes the braces", () => {
    expect(rendered).not.toContain("&#123;");
    expect(rendered).toContain("{{NickName}}");
  });
});

describe("the seeded welcome body", () => {
  it("loses nothing", () => {
    const rendered = roundTripThroughSchema(welcomeHtml);

    expect(detectLoss(welcomeHtml, rendered).lossless).toBe(true);
  });
});

describe("markup the schema cannot represent", () => {
  // Without this the guard could be a function that always says "lossless" and every test
  // above would still pass.
  const tableHtml =
    '<table cellpadding="0"><tbody><tr><td bgcolor="#3f6b43">Hej {{NickName}}</td></tr></tbody></table>';

  it("is reported as lossy rather than quietly rewritten", () => {
    const rendered = roundTripThroughSchema(tableHtml);
    const loss = detectLoss(tableHtml, rendered);

    expect(loss.lossless).toBe(false);
    expect(loss.elementsLost).toContain("table");
    expect(verdictFor(tableHtml, rendered, loss)).toBe("lossy");
  });

  it("still keeps the placeholder, so the operator is told about layout and not about tokens", () => {
    expect(detectLoss(tableHtml, roundTripThroughSchema(tableHtml)).tokensLost).toEqual([]);
  });
});

describe("placeholders the schema has never seen", () => {
  it("keeps an unrecognised placeholder rather than dropping it", () => {
    // An unknown token has to survive the round trip so the editor can show it as wrong.
    // Dropping it here would hide the very mistake the editor exists to surface.
    const html = "<p>Hej {{NickNmae}}</p>";

    expect(roundTripThroughSchema(html)).toContain("{{NickNmae}}");
  });
});
