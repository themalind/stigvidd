// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules the mail-template editor runs on, kept out of the components so they can be
// tested without driving a contenteditable. Everything here is pure: no DOM, no editor, no
// React. That matters more than usual for this feature, because jsdom does not implement
// editing at all -- a WYSIWYG cannot be driven by a test, so whatever is worth asserting has
// to live in a function that takes strings and returns strings.
//
// Two things it mirrors, and must keep mirroring:
//
//   backend/Core/Services/MailTemplateRenderer.cs   the {{Placeholder}} grammar and the
//                                                   case-insensitive matching
//   backend/Core/Validators/MailTemplate/           the length caps
//
// A mail body is not HTML we wrote. It is HTML an operator may have hand-written as SQL on
// the host, and the one outcome worse than having no editor is an editor that silently
// rewrites it. Most of this file exists to detect that -- see
// docs/notes/wysiwyg-over-operator-authored-html.md for what was measured.

import type { MailTemplateToken } from "@/types/types";

/** Mirrors UpdateMailTemplateRequestValidator; over these the API rejects the whole request. */
export const limits = {
  subject: 200,
  body: 50_000,
  description: 500,
} as const;

// ── the token grammar ────────────────────────────────────────────────────────

// MailTemplateRenderer's regex, character for character. Inner whitespace is tolerated, so
// {{ NickName }} and {{NickName}} are one placeholder; the name is deliberately boring so a
// typo cannot look like valid syntax.
const tokenSource = String.raw`\{\{\s*([A-Za-z0-9_]+)\s*\}\}`;

/** A fresh global matcher. Never share one: `lastIndex` on a shared regex is a bug factory. */
function tokenPattern(): RegExp {
  return new RegExp(tokenSource, "g");
}

export function tokenText(name: string): string {
  return `{{${name}}}`;
}

/**
 * The grammar anchored to the end of the input, for an editor input rule that fires as the
 * closing braces are typed. Exported so the TipTap extension does not carry its own copy of
 * the pattern — a divergence there would produce chips the backend will not substitute.
 */
export function trailingTokenPattern(): RegExp {
  return new RegExp(`${tokenSource}$`);
}

/**
 * Every distinct placeholder in a string, over the WHOLE string including tag interiors --
 * because that is what the backend does. `href="{{VerificationUrl}}"` is a real use of a
 * token and has to be counted as one.
 *
 * Case-insensitive dedupe, first spelling wins, in order of appearance.
 */
export function extractTokens(source: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const match of source.matchAll(tokenPattern())) {
    const name = match[1];
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  }

  return names;
}

// ── the HTML scanner, which everything below is built on ─────────────────────

export type HtmlPiece =
  | { kind: "text"; start: number; end: number }
  | { kind: "comment"; start: number; end: number }
  | { kind: "rawtext"; start: number; end: number }
  | {
      kind: "tag";
      start: number;
      end: number;
      tag: string;
      closing: boolean;
      attrs: ReadonlyMap<string, string>;
    };

// Elements whose content is not markup. `{{` inside one of these is not a placeholder the
// editor should chip, and a `<` inside one is not a tag.
const rawTextElements = new Set(["script", "style", "textarea", "title"]);

/**
 * Splits HTML into tags, comments, raw-text blocks and text, quote-aware.
 *
 * Quote-awareness is the whole point: without it `title="a > b"` ends the tag early and
 * everything after it is scanned as markup. It is a scanner rather than a parser because the
 * backend has no DOM either -- MailTemplateRenderer runs its regex over the raw string -- so
 * a DOM-derived idea of "where is a token" could disagree with the mail for any markup a
 * browser's error recovery would repair.
 */
export function scanHtml(html: string): HtmlPiece[] {
  const pieces: HtmlPiece[] = [];
  let index = 0;
  let textStart = 0;

  const flushText = (end: number) => {
    if (end > textStart) pieces.push({ kind: "text", start: textStart, end });
  };

  while (index < html.length) {
    const lt = html.indexOf("<", index);

    if (lt === -1) break;

    // A "<" that starts nothing is ordinary text.
    const next = html[lt + 1];
    const startsMarkup = next === "!" || next === "/" || (next !== undefined && /[A-Za-z]/.test(next));

    if (!startsMarkup) {
      index = lt + 1;
      continue;
    }

    if (html.startsWith("<!--", lt)) {
      const close = html.indexOf("-->", lt + 4);
      const end = close === -1 ? html.length : close + 3;
      flushText(lt);
      pieces.push({ kind: "comment", start: lt, end });
      index = end;
      textStart = end;
      continue;
    }

    const tag = readTag(html, lt);

    if (!tag) {
      index = lt + 1;
      continue;
    }

    flushText(lt);
    pieces.push(tag);
    index = tag.end;
    textStart = tag.end;

    if (!tag.closing && rawTextElements.has(tag.tag)) {
      const closer = new RegExp(`</${tag.tag}\\s*>`, "i");
      const rest = html.slice(tag.end);
      const found = closer.exec(rest);
      const contentEnd = found ? tag.end + found.index : html.length;

      if (contentEnd > tag.end) {
        pieces.push({ kind: "rawtext", start: tag.end, end: contentEnd });
      }

      index = contentEnd;
      textStart = contentEnd;
    }
  }

  flushText(html.length);

  return pieces;
}

function readTag(html: string, start: number): (HtmlPiece & { kind: "tag" }) | null {
  let cursor = start + 1;
  const closing = html[cursor] === "/";

  if (closing) cursor += 1;

  const nameMatch = /^[A-Za-z][A-Za-z0-9]*/.exec(html.slice(cursor));

  if (!nameMatch) return null;

  const tag = nameMatch[0].toLowerCase();
  cursor += nameMatch[0].length;

  const attrsStart = cursor;
  let quote: string | null = null;

  while (cursor < html.length) {
    const char = html[cursor];

    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return {
        kind: "tag",
        start,
        end: cursor + 1,
        tag,
        closing,
        attrs: readAttributes(html.slice(attrsStart, cursor)),
      };
    }

    cursor += 1;
  }

  // Unterminated tag: treat the remainder as the tag rather than losing it.
  return {
    kind: "tag",
    start,
    end: html.length,
    tag,
    closing,
    attrs: readAttributes(html.slice(attrsStart)),
  };
}

const attributePattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;

function readAttributes(source: string): ReadonlyMap<string, string> {
  const attrs = new Map<string, string>();

  for (const match of source.matchAll(attributePattern)) {
    attrs.set(match[1].toLowerCase(), unquote(match[2] ?? ""));
  }

  return attrs;
}

function unquote(raw: string): string {
  return raw.length >= 2 && (raw[0] === '"' || raw[0] === "'") && raw[raw.length - 1] === raw[0]
    ? raw.slice(1, -1)
    : raw;
}

// ── {{Token}} <-> chip, and the exact inverse ────────────────────────────────

/**
 * Rewrites `{{Name}}` to `<span data-token="Name"></span>` in TEXT ONLY.
 *
 * Tag interiors are copied through byte for byte, so `href="{{VerificationUrl}}"` is never
 * touched -- the verification button depends on that, and the guarantee is structural rather
 * than a negative lookahead somebody can defeat. A token already broken up by markup
 * (`{{Nick<b>Name</b>}}`) matches nothing and stays literal text, which is right: the backend
 * would not substitute it either, so the editor and the mail agree.
 *
 * One deliberate normalisation: inner whitespace is not preserved, so `{{ A }}` comes
 * back as `{{A}}` -- the chip stores the name, not the spacing. Those are the same
 * placeholder to MailTemplateRenderer, so `detectLoss` correctly calls it equivalent
 * rather than lossy; and because the page only saves a body the operator actually
 * edited, it never becomes a silent rewrite of somebody's row.
 */
export function embedTokenPlaceholders(html: string): string {
  const pieces = scanHtml(html);
  let out = "";
  let cursor = 0;

  for (const piece of pieces) {
    out += html.slice(cursor, piece.start);

    const slice = html.slice(piece.start, piece.end);

    out +=
      piece.kind === "text"
        ? slice.replace(tokenPattern(), (_, name: string) => `<span data-token="${name}"></span>`)
        : slice;

    cursor = piece.end;
  }

  return out + html.slice(cursor);
}

// Liberal about attribute order and extra attributes, so a TipTap upgrade that starts adding
// a class degrades to "still correct" rather than "leaves a <span> in somebody's mail".
// Strict about the empty body, so it can never swallow the text between two adjacent chips.
const placeholderSpan = /<span\b[^>]*\sdata-token="([A-Za-z0-9_]+)"[^>]*><\/span>/gi;

/** The inverse of {@link embedTokenPlaceholders}. */
export function unwrapTokenPlaceholders(html: string): string {
  return html.replace(placeholderSpan, (_, name: string) => tokenText(name));
}

// ── entities and text ────────────────────────────────────────────────────────

const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Enough of an entity decoder for mail bodies, without reaching for a DOM. */
function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);

      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }

    return namedEntities[body.toLowerCase()] ?? whole;
  });
}

/** Entity-decoded, whitespace-collapsed text content. Comments and raw text do not count. */
export function normalizeText(html: string): string {
  const text = scanHtml(html)
    .filter((piece) => piece.kind === "text")
    .map((piece) => html.slice(piece.start, piece.end))
    .join(" ");

  return (
    decodeEntities(text)
      // Placeholder spacing is canonicalised first: {{ A }} and {{A}} are one placeholder to
      // MailTemplateRenderer, so a difference in spacing is not a difference in wording, and
      // counting it as one would flag an ordinary template as lossy and send the operator to
      // the source view for nothing.
      .replace(tokenPattern(), (_, name: string) => tokenText(name))
      .replace(/\s+/g, " ")
      .trim()
  );
}

// Blocks that should read as a line break once the markup is gone.
const blockElements = new Set([
  "p", "div", "br", "hr", "li", "tr", "table", "blockquote", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
]);

/**
 * A plain-text rendering of an HTML body, for the editor's "generate from HTML" action.
 *
 * Deliberately only ever offered as an explicit button, never applied on save: BodyText is
 * required, goes out as the text half of every multipart/alternative mail, and may well have
 * been tuned by hand. Regenerating it silently would throw that away.
 *
 * Placeholders survive untouched, since they mean the same thing in both bodies.
 */
export function htmlToPlainText(html: string): string {
  let out = "";

  for (const piece of scanHtml(html)) {
    if (piece.kind === "text") {
      out += html.slice(piece.start, piece.end);
      continue;
    }

    if (piece.kind === "tag" && blockElements.has(piece.tag)) {
      out += "\n";
      if (piece.tag === "p" && piece.closing) out += "\n";
    }
  }

  return decodeEntities(out)
    // Collapse runs of spaces and tabs, but keep the line structure just built.
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── loss detection ───────────────────────────────────────────────────────────

export type ElementUse = { count: number; attrs: ReadonlySet<string> };

/** How many of each element, and which attributes were seen on it. */
export function elementInventory(html: string): ReadonlyMap<string, ElementUse> {
  const inventory = new Map<string, { count: number; attrs: Set<string> }>();

  for (const piece of scanHtml(html)) {
    if (piece.kind !== "tag" || piece.closing) continue;

    const entry = inventory.get(piece.tag) ?? { count: 0, attrs: new Set<string>() };
    entry.count += 1;
    for (const attr of piece.attrs.keys()) entry.attrs.add(attr);
    inventory.set(piece.tag, entry);
  }

  return inventory;
}

export type LossReport = {
  lossless: boolean;
  tokensLost: string[];
  elementsLost: string[];
  attributesLost: { tag: string; attr: string }[];
  textChanged: boolean;
};

/**
 * What a trip through the editor's schema would DROP. One-directional on purpose.
 *
 * Asking "are these two strings equal" is useless here: the stored bodies have literal
 * newlines between their `<p>` blocks and no schema-based editor reproduces those, so an
 * equality check fires on every real input and gets trained away on day one. Asking "did
 * anything disappear" is both answerable and the thing actually worth refusing on -- it is
 * blind to formatting differences, which is exactly the point.
 */
export function detectLoss(stored: string, rendered: string): LossReport {
  const renderedTokens = new Set(extractTokens(rendered).map((name) => name.toLowerCase()));

  // Compared case-insensitively, because the renderer matches that way -- but reported in the
  // spelling the operator actually wrote, since this ends up in a sentence shown to them.
  const tokensLost = extractTokens(stored).filter(
    (name) => !renderedTokens.has(name.toLowerCase()),
  );

  const before = elementInventory(stored);
  const after = elementInventory(rendered);

  const elementsLost: string[] = [];
  const attributesLost: { tag: string; attr: string }[] = [];

  for (const [tag, use] of before) {
    const seen = after.get(tag);

    if (!seen || seen.count < use.count) {
      elementsLost.push(tag);
      continue;
    }

    for (const attr of use.attrs) {
      if (!seen.attrs.has(attr)) attributesLost.push({ tag, attr });
    }
  }

  const textChanged = normalizeText(stored) !== normalizeText(rendered);

  return {
    lossless:
      tokensLost.length === 0 &&
      elementsLost.length === 0 &&
      attributesLost.length === 0 &&
      !textChanged,
    tokensLost,
    elementsLost,
    attributesLost,
    textChanged,
  };
}

export type RoundTripVerdict = "identical" | "equivalent" | "lossy";

export function verdictFor(stored: string, rendered: string, loss: LossReport): RoundTripVerdict {
  if (stored === rendered) return "identical";
  return loss.lossless ? "equivalent" : "lossy";
}

/** One sentence naming what would be lost, for the banner over the source view. */
export function describeLoss(report: LossReport): string {
  const parts: string[] = [];

  if (report.tokensLost.length > 0) {
    parts.push(`the placeholder${report.tokensLost.length > 1 ? "s" : ""} ${report.tokensLost.map(tokenText).join(", ")}`);
  }

  if (report.elementsLost.length > 0) {
    parts.push(`the element${report.elementsLost.length > 1 ? "s" : ""} ${report.elementsLost.map((tag) => `<${tag}>`).join(", ")}`);
  }

  if (report.attributesLost.length > 0) {
    parts.push(
      `the attribute${report.attributesLost.length > 1 ? "s" : ""} ` +
        report.attributesLost.map(({ tag, attr }) => `${attr} on <${tag}>`).join(", "),
    );
  }

  if (report.textChanged) parts.push("some of the wording");

  if (parts.length === 0) return "Nothing would be lost.";

  return `The visual editor cannot keep ${joinWithAnd(parts)}. Edit the HTML source instead to keep it exactly as it is.`;
}

function joinWithAnd(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// ── URLs ─────────────────────────────────────────────────────────────────────

const allowedSchemes = ["http:", "https:", "mailto:", "tel:", "cid:"];

/**
 * Mirrors MailHtmlPolicy on the backend, so the editor refuses what the API would refuse
 * rather than letting an operator find out on save.
 */
export function isSafeMailUrl(url: string): boolean {
  const cleaned = [...decodeEntities(url)]
    // Control characters are ignored by URL parsers, so a scheme broken up by one still
    // resolves; strip them before deciding rather than after.
    .filter((char) => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127)
    .join("")
    .trim();

  if (cleaned.length === 0) return false;

  // A placeholder carries its own scheme in the substituted value.
  if (cleaned.startsWith("{{")) return true;

  return allowedSchemes.some((scheme) => cleaned.toLowerCase().startsWith(scheme));
}

// ── inline styles: recognise without rewriting ───────────────────────────────

// Byte-identical to the anchor the AddEmailVerification migration seeds, so applying the
// preset to that template is a no-op rather than a diff.
export const buttonLinkStyle =
  "display:inline-block;padding:12px 20px;border-radius:8px;background:#3f6b43;color:#ffffff;text-decoration:none";

export const codeParagraphStyle = "font-size:28px;letter-spacing:6px;font-weight:700";

export function parseStyle(style: string | null | undefined): ReadonlyMap<string, string> {
  const declarations = new Map<string, string>();

  for (const part of (style ?? "").split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;

    const property = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();

    if (property) declarations.set(property, value.replace(/\s+/g, " "));
  }

  return declarations;
}

/**
 * Puts a declaration value into a form that survives a trip through the CSSOM.
 *
 * ProseMirror writes the style attribute as `element.style.cssText`, not `setAttribute`, so
 * the browser reparses and re-serialises it: `#3f6b43` comes back as `rgb(63, 107, 67)` and
 * `padding:12px 20px` gains spaces. Measured -- jsdom leaves a `setAttribute` style attribute
 * completely alone, so this is the editor's doing and it happens in a real browser too.
 *
 * That means a button recognised before an edit would stop being recognised after one, and
 * the toolbar would lie. Comparing normalised values instead is what keeps recognition stable
 * across the round trip.
 */
function normalizeDeclarationValue(value: string): string {
  const collapsed = value.trim().replace(/\s+/g, " ").toLowerCase();

  return collapsed.replace(/#([0-9a-f]{3}|[0-9a-f]{6})\b/g, (_, hex: string) => {
    const full =
      hex.length === 3
        ? hex.split("").map((char) => char + char).join("")
        : hex;

    const [r, g, b] = [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16));

    return `rgb(${r}, ${g}, ${b})`;
  });
}

/**
 * Compares declaration SETS rather than strings, so a hand-written button with the same
 * rules in a different order still lights the toolbar. Recognition is deliberately fuzzy and
 * rewriting is deliberately explicit: matching loosely lets us show the operator what their
 * markup is, without that recognition becoming a licence to normalise it.
 */
function styleMatches(style: string | null | undefined, preset: string): boolean {
  const actual = parseStyle(style);
  const wanted = parseStyle(preset);

  if (actual.size !== wanted.size) return false;

  for (const [property, value] of wanted) {
    const seen = actual.get(property);

    if (seen === undefined) return false;
    if (normalizeDeclarationValue(seen) !== normalizeDeclarationValue(value)) return false;
  }

  return true;
}

export function isButtonLink(style: string | null | undefined): boolean {
  return styleMatches(style, buttonLinkStyle);
}

export function isCodeParagraph(style: string | null | undefined): boolean {
  return styleMatches(style, codeParagraphStyle);
}

// ── what the editor tells the operator about tokens ──────────────────────────

export type TemplateDraft = {
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

export type TokenReport = {
  /** Used but not supplied. Every one of these stops the mail; saving is refused. */
  unknown: string[];
  /** Supplied but unused. Renders fine, and is how a verification mail loses its link. */
  missing: string[];
  /** Which parts each used token appears in, for the palette's per-field state. */
  used: Set<string>;
};

/**
 * The two failure modes, which are NOT symmetric -- see
 * backend/Tests/UnitTests/ServiceTests/MailTemplateRendererTests.cs, where both are measured.
 *
 * A `known` list of null means the API does not know this template key either, so nothing in
 * it can honestly be called unknown.
 */
export function reviewTokens(
  draft: TemplateDraft,
  known: readonly MailTemplateToken[] | null,
): TokenReport {
  // One pass per part rather than two. The parts are scanned separately and merged, never
  // concatenated: the token grammar tolerates whitespace inside the braces, so joining them
  // would let a "{{" ending the subject pair with a "}}" opening the body.
  const used = new Set<string>();
  const names: string[] = [];

  for (const part of [draft.subject, draft.bodyHtml, draft.bodyText]) {
    for (const name of extractTokens(part)) {
      const key = name.toLowerCase();
      if (!used.has(key)) {
        used.add(key);
        names.push(name);
      }
    }
  }

  if (known === null) return { unknown: [], missing: [], used };

  const declared = new Set(known.map((token) => token.name.toLowerCase()));

  return {
    unknown: names.filter((name) => !declared.has(name.toLowerCase())),
    missing: known.filter((token) => !used.has(token.name.toLowerCase())).map((token) => token.name),
    used,
  };
}

/** Inserting a token into a plain input or textarea at the caret. */
export function insertTokenAt(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  name: string,
): { value: string; caret: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const inserted = tokenText(name);

  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    caret: start + inserted.length,
  };
}
