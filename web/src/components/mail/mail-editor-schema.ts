// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The document model the visual editor works in, and the one function that says whether a
// given mail body survives it.
//
// Two decisions are load-bearing and both are about NOT inventing markup:
//
//  1. `style` (and a few table attributes) are carried through verbatim as opaque strings.
//     Mail is styled inline, and TipTap's default schema drops attributes it does not know --
//     which would turn the verification button into a plain link. Passthrough is preferred to
//     a dedicated Button node because it preserves ANY operator's markup, where a node
//     matched on a known style string silently loses anything that differs from the preset.
//
//  2. Link's defaults are turned off. Out of the box TipTap adds rel="noopener noreferrer
//     nofollow" and target="_blank" to every link and autolinks typed text -- so merely
//     opening a template would rewrite it, on every row, for ever.
//
// Measured, including the defaults that do NOT do what they look like they do:
// docs/notes/wysiwyg-over-operator-authored-html.md

import { Editor, Extension, Node, nodeInputRule } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  embedTokenPlaceholders,
  isSafeMailUrl,
  tokenText,
  trailingTokenPattern,
  unwrapTokenPlaceholders,
} from "@/lib/mail-template";

/**
 * A placeholder, as an inline ATOM.
 *
 * Atom is the whole point: an atom has no editable content, so a token cannot be split by a
 * mark boundary, cannot be half-deleted into `{{VerificationUr}}`, and cannot be typed into.
 * It is one node or it is gone -- and a half-deleted placeholder is precisely the edit that
 * stops the mail without anybody noticing.
 */
const MailToken = Node.create({
  name: "mailToken",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-token") ?? "",
        renderHTML: (attributes) => ({ "data-token": attributes.name as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-token]" }];
  },

  // EXACTLY this shape and nothing merged in: the serialized form is a contract with
  // unwrapTokenPlaceholders and, through it, with the backend's regex. It is not a styling
  // surface -- the chip's appearance is CSS on [data-token].
  renderHTML({ node }) {
    return ["span", { "data-token": node.attrs.name as string }];
  },

  // What getText() and a copy-as-text produce. Must be the literal placeholder.
  renderText({ node }) {
    return tokenText(node.attrs.name as string);
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: trailingTokenPattern(),
        type: this.type,
        getAttributes: (match) => ({ name: match[1] }),
      }),
    ];
  },
});

/**
 * Carries mail-specific attributes through the schema untouched.
 *
 * Every one of these is an attribute a real mail body uses and TipTap would otherwise
 * discard. The list is meant to grow from evidence -- `detectLoss` names what was dropped, so
 * anything it reports on a real row belongs here.
 */
const PassthroughAttributes = Extension.create({
  name: "mailPassthroughAttributes",

  addGlobalAttributes() {
    const passthrough = (name: string) => ({
      default: null,
      parseHTML: (element: HTMLElement) => element.getAttribute(name),
      renderHTML: (attributes: Record<string, unknown>) =>
        attributes[name] ? { [name]: attributes[name] as string } : {},
    });

    return [
      {
        types: [
          "paragraph",
          "heading",
          "bulletList",
          "orderedList",
          "listItem",
          "blockquote",
          "link",
          "horizontalRule",
        ],
        attributes: {
          style: passthrough("style"),
          align: passthrough("align"),
          class: passthrough("class"),
        },
      },
    ];
  },
});

export const mailEditorExtensions = [
  // StarterKit's own Link is switched off and configured explicitly below. Its defaults are
  // not merely unhelpful here, they are destructive: passing `HTMLAttributes: {}` does NOT
  // clear them -- measured, the rel and target still came out -- so they have to be nulled by
  // name, and mergeAttributes then drops them.
  StarterKit.configure({ link: false }),
  Link.configure({
    // Each of these invents markup the operator did not write. Left on, merely OPENING a
    // template would rewrite every link in it, on every row, for ever.
    autolink: false,
    linkOnPaste: false,
    openOnClick: false,
    HTMLAttributes: { target: null, rel: null },
    // A placeholder is a legitimate href: the scheme arrives with the substituted value, and
    // the verification button is exactly this case.
    isAllowedUri: (uri: string) => isSafeMailUrl(uri),
  }),
  PassthroughAttributes,
  MailToken,
];

/**
 * Puts a stored mail body through the editor's schema and back, WITHOUT a DOM element.
 *
 * A headless editor is cheap, and it is what makes the loss guard possible at all: the page
 * can ask "what would the visual editor do to this row" before showing it to anybody, and
 * a test can ask the same question under jsdom, where actually typing is impossible.
 */
export function roundTripThroughSchema(storedHtml: string): string {
  const editor = new Editor({
    extensions: mailEditorExtensions,
    content: embedTokenPlaceholders(storedHtml),
  });

  try {
    return unwrapTokenPlaceholders(editor.getHTML());
  } finally {
    editor.destroy();
  }
}
