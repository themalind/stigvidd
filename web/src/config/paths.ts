// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

type Search = Record<string, string>;

const withSearch = (path: string, search?: Search) =>
  search && Object.keys(search).length > 0 ? `${path}?${new URLSearchParams(search)}` : path;

// keep-comment: the router passes ":param" to the builders, so one function gives both the pattern and the link
export const paths = {
  login: "/",
  dashboard: "/dashboard",
  trails: (search?: Search) => withSearch("/trails", search),
  areas: "/areas",
  media: "/media",
  users: "/users",
  trailImport: "/trail-import",
  trailImportSession: (sessionId: number | string) => `/trail-import/${sessionId}`,
  moderation: "/moderation",
  hikeSubmissions: "/hike-submissions",
  hikeSubmission: (identifier: string) => `/hike-submissions/${identifier}`,
  mailTemplates: "/mail-templates",
  mailTemplate: (identifier: string) => `/mail-templates/${identifier}`,
  mailOutbox: (search?: Search) => withSearch("/mail-outbox", search),
  migration: "/migration",
} as const;
