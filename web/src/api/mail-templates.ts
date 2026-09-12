// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  MailTemplate,
  MailTemplateListItem,
  MailTemplatePreview,
  UpdateMailTemplateRequest,
} from "@/types/types";
import {
  mailTemplatesGetAll,
  mailTemplatesGetByIdentifier,
  mailTemplatesPreview,
  mailTemplatesUpdate,
} from "./generated/mail-templates/mail-templates";

// Wrappers over the orval-generated client, matching the convention in src/api/trail.ts: the
// generated models are looser (nullable/optional) than the UI's hand-written types, so
// responses are asserted back to those here. Auth and base URL come from the customFetch
// mutator.

export async function getMailTemplates(): Promise<MailTemplateListItem[]> {
  return (await mailTemplatesGetAll()) as MailTemplateListItem[];
}

export async function getMailTemplate(identifier: string): Promise<MailTemplate> {
  return (await mailTemplatesGetByIdentifier(identifier)) as MailTemplate;
}

export async function updateMailTemplate(
  identifier: string,
  request: UpdateMailTemplateRequest,
): Promise<MailTemplate> {
  return (await mailTemplatesUpdate(identifier, request)) as MailTemplate;
}

/**
 * Renders an unsaved draft through the API's real renderer, with the catalogue's sample
 * values. Writes nothing -- and a draft that would fail to send fails here first, with the
 * message the enqueue would have produced.
 */
export async function previewMailTemplate(
  identifier: string,
  draft: { subject: string; bodyHtml: string; bodyText: string },
): Promise<MailTemplatePreview> {
  return (await mailTemplatesPreview(identifier, draft)) as MailTemplatePreview;
}
