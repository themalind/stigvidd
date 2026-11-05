// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMailTemplatesGetAllQueryKey,
  getMailTemplatesGetAllSuspenseQueryOptions,
  getMailTemplatesGetByIdentifierQueryKey,
  getMailTemplatesGetByIdentifierSuspenseQueryOptions,
  mailTemplatesPreview,
  mailTemplatesUpdate,
} from "@/api/generated/mail-templates/mail-templates";
import type { PreviewMailTemplateRequest, UpdateMailTemplateRequest } from "@/api/generated/model";

export const mailTemplatesQueryOptions = () => getMailTemplatesGetAllSuspenseQueryOptions();

export const mailTemplateQueryOptions = (identifier: string) =>
  getMailTemplatesGetByIdentifierSuspenseQueryOptions(identifier);

export function useSaveMailTemplate(identifier: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateMailTemplateRequest) => mailTemplatesUpdate(identifier, request),
    onSuccess: (saved) => {
      queryClient.setQueryData(getMailTemplatesGetByIdentifierQueryKey(identifier), saved);
      return queryClient.invalidateQueries({ queryKey: getMailTemplatesGetAllQueryKey() });
    },
    meta: { successMessage: "Template saved. The next mail sent will use it." },
  });
}

/**
 * Renders an unsaved draft through the API's real renderer, with the catalogue's sample
 * values. Writes nothing -- and a draft that would fail to send fails here first, with the
 * message the enqueue would have produced.
 */
export function usePreviewMailTemplate(identifier: string) {
  return useMutation({
    mutationFn: (draft: PreviewMailTemplateRequest) => mailTemplatesPreview(identifier, draft),
  });
}
