// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Byte sizes, everywhere in the admin. There were three of these — in `media-browse.ts`,
 * `media-upload.ts` and inside `trail-import-page.tsx` — and they disagreed on both the
 * zero case and the spelling of the kilobyte.
 *
 * Zero reads as "—" rather than "0 B": every caller reaches it through `?? 0` on a size the
 * server did not record, so it means unknown, not empty.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// keep-comment: a deleted account has no nickname left, and an empty cell reads as a rendering fault
export function displayName(nickName: string | null | undefined): string {
  return nickName?.trim() ? nickName : "Account deleted";
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "—";
}
