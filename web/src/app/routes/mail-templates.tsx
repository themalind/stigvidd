// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSuspenseQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/page";
import { mailTemplatesQueryOptions } from "@/features/mail/api/mail-templates";
import { TemplateRow } from "@/features/mail/components/template-row";

export default function MailTemplatesPage() {
  const { data: templates } = useSuspenseQuery(mailTemplatesQueryOptions());

  return (
    <Page>
      <PageHeader
        title="Mail templates"
        description="The copy the API mails out. It lives in the database rather than in the code so wording can be corrected without a deploy — an edit here takes effect on the next mail sent."
      />

      {templates.length === 0 ? (
        <EmptyState>No mail templates exist yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <TemplateRow key={template.identifier} template={template} />
          ))}
        </div>
      )}
    </Page>
  );
}
