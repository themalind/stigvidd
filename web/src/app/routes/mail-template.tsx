// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useParams, Link as RouterLink } from "react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Page } from "@/components/page";
import { paths } from "@/config/paths";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mailTemplateQueryOptions } from "@/features/mail/api/mail-templates";
import { MailTemplateEditor } from "@/features/mail/components/mail-template-editor";

export default function MailTemplatePage() {
  const { identifier = "" } = useParams();

  return (
    <QueryBoundary resetKeys={[identifier]} errorFallback={() => <TemplateUnavailable />}>
      <LoadedTemplate identifier={identifier} />
    </QueryBoundary>
  );
}

function TemplateUnavailable() {
  return (
    <Page width="narrow">
      <Card>
        <CardHeader>
          <CardTitle>Template not available</CardTitle>
          <CardDescription>It could not be loaded, so there is nothing safe to edit here.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <RouterLink to={paths.mailTemplates}>Back to templates</RouterLink>
          </Button>
        </CardContent>
      </Card>
    </Page>
  );
}

function LoadedTemplate({ identifier }: { identifier: string }) {
  const { data: template } = useSuspenseQuery(mailTemplateQueryOptions(identifier));

  return (
    <Page width="wide">
      <MailTemplateEditor key={identifier} identifier={identifier} template={template} />
    </Page>
  );
}
