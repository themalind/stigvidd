// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { siteContent } from "@/content/site-content";

const { sv, en } = siteContent;

describe("siteContent", () => {
  it("has a card for every feature in both languages, with the same icons in the same order", () => {
    expect(en.features.map((f) => f.icon)).toEqual(sv.features.map((f) => f.icon));
  });

  it("shows the same screenshots in both languages", () => {
    expect(en.screenshots.map((s) => s.src)).toEqual(sv.screenshots.map((s) => s.src));
  });

  it("keeps the same anchors in both headers, since the section ids are shared", () => {
    expect(en.header.nav.map((n) => n.href)).toEqual(sv.header.nav.map((n) => n.href));
  });

  it("has as many install steps, questions and legal links in both languages", () => {
    expect(en.install.steps).toHaveLength(sv.install.steps.length);
    expect(en.faq).toHaveLength(sv.faq.length);
    expect(en.footer.legal).toHaveLength(sv.footer.legal.length);
  });

  it("links each language to the other", () => {
    expect(sv.header.otherLanguage).toMatchObject({ href: en.header.home, lang: "en" });
    expect(en.header.otherLanguage).toMatchObject({ href: sv.header.home, lang: "sv" });
  });

  it("sends English readers to the English half of the bilingual legal pages", () => {
    expect(en.footer.legal.map((l) => l.href)).toEqual(sv.footer.legal.map((l) => `${l.href}#english`));
  });
});
