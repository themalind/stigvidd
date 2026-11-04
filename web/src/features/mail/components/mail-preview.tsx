// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MailTemplatePreview } from "@/types/types";

type Props = { preview: MailTemplatePreview };

/**
 * The rendered draft, in a sandboxed iframe.
 *
 * Two reasons it is an iframe rather than dangerouslySetInnerHTML, and both matter:
 *
 *  - The admin's own Tailwind would otherwise style the mail. The editing canvas already
 *    lies about what a mail looks like for exactly that reason; a preview that lies too
 *    would be worse than none.
 *  - A mail body is operator-supplied HTML. It is checked on save by MailHtmlPolicy, but a
 *    row can also have been written straight into Postgres by hand, and this is the first
 *    HTML sink in web/. An empty `sandbox` attribute means no scripts, no forms, no
 *    navigation, no same-origin access.
 */
export default function MailPreview({ preview }: Props) {
  return (
    <div className="space-y-3">
      <div className="rounded-xs border border-input p-3">
        <p className="text-xs text-muted-foreground">Subject</p>
        <p className="font-medium break-words">{preview.subject}</p>
      </div>

      <Tabs defaultValue="html">
        <TabsList>
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="text">Plain text</TabsTrigger>
        </TabsList>

        <TabsContent value="html">
          <iframe
            // No allow-scripts, no allow-same-origin: the most restrictive sandbox there is.
            sandbox=""
            title="Mail preview"
            className="h-[28rem] w-full rounded-xs border border-input bg-white"
            srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light"></head><body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">${preview.bodyHtml}</body></html>`}
          />
        </TabsContent>

        <TabsContent value="text">
          <pre className="h-[28rem] overflow-auto rounded-xs border border-input bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
            {preview.bodyText}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
