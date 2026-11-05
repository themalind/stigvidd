// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// keep-comment: folds case and diacritics so "boras" finds "Borås" and "sjoleden" finds "Sjöleden"
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("sv");
}

export function searchTerms(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

// keep-comment: every word must appear somewhere, in any order, so "kråkered kråkstigen" finds "Kråkstigen, Kråkered"
export function matchesAll(text: string, terms: string[]): boolean {
  const haystack = fold(text);
  return terms.every((term) => haystack.includes(term));
}
